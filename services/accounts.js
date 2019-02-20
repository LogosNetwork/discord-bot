let methods = {}
const models = require('../models')
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const LogosWallet = require('@logosnetwork/logos-webwallet-sdk')
const { secret } = require('../config.json')

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
          const newWallet = new LogosWallet.Wallet({password: secret, mqtt: false})
          await newWallet.createAccount()
          const newEncryptedWallet = newWallet.encrypt()
          account = await methods.createAccount(id, newEncryptedWallet)
          const encryptedWallet = account.dataValues.wallet
          const wallet = new LogosWallet.Wallet({password: secret, mqtt: false})
          wallet.load(encryptedWallet)
          await wallet.createAccount()
          resolve(wallet)
        } else {
          const encryptedWallet = account.dataValues.wallet
          const wallet = new LogosWallet.Wallet({password: secret, mqtt: false})
          wallet.load(encryptedWallet)
          await wallet.createAccount()
          resolve(wallet)
        }
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
