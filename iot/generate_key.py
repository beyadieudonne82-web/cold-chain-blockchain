from eth_account import Account

acc = Account.create()
print("Adresse du capteur :", acc.address)
print("Cle privee         :", acc.key.hex())