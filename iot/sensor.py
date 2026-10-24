import json
import os
import random
import sys
import time

import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak

from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

HOST = os.getenv("MQTT_HOST")
PORT = int(os.getenv("MQTT_PORT", "8883"))
USER = os.getenv("MQTT_USER")
PASSWORD = os.getenv("MQTT_PASSWORD")
DEVICE_KEY = (os.getenv("DEVICE_PRIVATE_KEY") or "").strip()
if not DEVICE_KEY:
    sys.exit("Erreur : DEVICE_PRIVATE_KEY introuvable. Vérifiez le fichier iot/.env")
if not DEVICE_KEY.startswith("0x"):
    DEVICE_KEY = "0x" + DEVICE_KEY
LOT_NAME = os.getenv("LOT_NAME", "LOT-2026-001")
INTERVAL = float(os.getenv("INTERVAL_SECONDS", "2"))

LOT_ID = keccak(text=LOT_NAME)
ACCOUNT = Account.from_key(DEVICE_KEY)
TOPIC = f"froid/lot/{LOT_NAME}"

# python sensor.py --breach  -> simule une rupture de la chaîne du froid
BREACH_MODE = "--breach" in sys.argv


def build_leaf(temp_tenths: int, timestamp: int) -> bytes:
    packed = (
        LOT_ID
        + temp_tenths.to_bytes(2, "big", signed=True)
        + timestamp.to_bytes(8, "big")
    )
    return keccak(packed)


def sign_leaf(leaf: bytes) -> str:
    signed = Account.sign_message(encode_defunct(primitive=leaf), DEVICE_KEY)
    sig = signed.signature.hex()
    return sig if sig.startswith("0x") else "0x" + sig


def next_temperature(count: int) -> int:
    if BREACH_MODE and count >= 5:
        return random.randint(95, 130)
    return random.randint(30, 70)


def on_connect(client, userdata, flags, reason_code, properties=None):
    print("Connecté au broker MQTT :", reason_code)


client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"capteur-{LOT_NAME}")
client.username_pw_set(USER, PASSWORD)
client.tls_set()
client.on_connect = on_connect
client.connect(HOST, PORT)
client.loop_start()

print("Capteur démarré :", ACCOUNT.address)
print("Topic :", TOPIC, "| mode rupture :", BREACH_MODE)

count = 0
try:
    while True:
        temp = next_temperature(count)
        ts = int(time.time())
        leaf = build_leaf(temp, ts)

        payload = {
            "lotName": LOT_NAME,
            "lotId": "0x" + LOT_ID.hex(),
            "device": ACCOUNT.address,
            "temperature": temp,
            "timestamp": ts,
            "leaf": "0x" + leaf.hex(),
            "signature": sign_leaf(leaf),
        }
        client.publish(TOPIC, json.dumps(payload), qos=1)
        print(f"#{count} {temp / 10:.1f} °C envoyé")

        count += 1
        time.sleep(INTERVAL)
except KeyboardInterrupt:
    print("Arrêt du capteur")
    client.loop_stop()
    client.disconnect()