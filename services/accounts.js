let methods = {}
const models = require('../models')
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const LogosWallet = require('@logosnetwork/logos-webwallet-sdk')
const axios = require('axios')
const { secret, delegateAddress, rpcProxy } = require('../config.json')
let delegates = null

methods.getDelegates = async () => {
  if (delegates) return delegates
  let res = await axios.get(delegateAddress)
  delegates = res.data
  return delegates
}

methods.setDelegates = (newDelegates) => {
  delegates = newDelegates
}

methods.findOrCreateWallet = (id) => {
  return new Promise((resolve, reject) => {
    models.account
      .findOne({
       where: {
        discord_id: {
           [Op.eq]: id
         }
       }
      })
      .then(async function(account) {
        if (account === null) {
          // Could not find the wallet

          // Default rpc
          let rpc = {
            delegates: await methods.getDelegates()
          }
          if (rpcProxy) rpc.proxy = rpcProxy

          // Create new wallet using our secrect key to encrypt
          const newWallet = new LogosWallet.Wallet(
            {
              password: secret,
              fullSync: false,
              mqtt: false,
              rpc
            }
          )

          // Initalize the account inside the wallet
          await newWallet.createAccount()

          // Get the encrypted wallet
          const newEncryptedWallet = newWallet.encrypt()

          // Save the new wallet to the postgres Database
          methods.createAccount(id, newEncryptedWallet)

          // Resolve the wallet
          resolve(newWallet)
        } else {
          // Wallet was found
          const encryptedWallet = account.dataValues.wallet

          // Default rpc
          let rpc = {
            delegates: await methods.getDelegates()
          }
          if (rpcProxy) rpc.proxy = rpcProxy

          // Intalize the wallet with our secret key and decrypt the wallet
          const wallet = new LogosWallet.Wallet(
            {
              password: secret,
              fullSync: false,
              mqtt: false,
              rpc
            }
          )

          // Decrypt the encrypted wallet
          wallet.load(encryptedWallet)

          // Initalize the account inside the wallet
          await wallet.createAccount()
          
          // Resolve the wallet
          resolve(wallet)
        }
      })
      .catch((err) => {
        reject(err)
      })
  })
}

methods.isOnboarded = (id) => {
  return new Promise((resolve, reject) => {
    models.account
      .findOne({
        where: {
          discord_id: {
            [Op.eq]: id
          }
        }
      })
      .then(account => {
        if (account === null) {
          resolve(false)
        } else {
          if (!account.dataValues.onboarded) {
            resolve(false)
          } else {
            resolve(account.dataValues.onboarded)
          }
        }
      })
      .catch((err) => {
        reject(err)
      })
  })
}

methods.onboard = (id) => {
  return new Promise((resolve, reject) => {
    models.account
      .findOne({
        where: {
          discord_id: {
            [Op.eq]: id
          }
        }
      })
      .then(account => {
        account.onboarded = true
        account.save().then(() => {
          resolve(true)
        })
      })
      .catch((err) => {
        reject(err)
      })
  })
}

methods.createAccount = (id, wallet) => {
  return new Promise((resolve, reject) => {
    models.account
      .create({
       discord_id: id,
       wallet: wallet
      })
      .then(account => {
        resolve(account)
      })
      .catch((err) => {
        reject(err)
      })
  })
}
module.exports = methods
