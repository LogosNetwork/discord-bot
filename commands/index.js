let methods = {}
const Accounts = require('../services/accounts')
const Logos = require('@logosnetwork/logos-rpc-client')
const RPC = new Logos({ url: `http://100.25.175.142:55000`, debug: false })
const bigInt = require('big-integer')

methods.pendingHashes = {}

methods.balance = async (args, message) => {
  const authorID = message.author.id
  const wallet = await Accounts.findOrCreateWallet(authorID)
  message.reply(`Your balance is ${RPC.convert.fromReason(wallet.account.pendingBalance, 'LOGOS')} Logos`)
}

methods.deposit = async (args, message) => {
  const authorID = message.author.id
  const wallet = await Accounts.findOrCreateWallet(authorID)
  message.reply(`Your wallet address is ${wallet.account.address} \n QR: https://chart.googleapis.com/chart?cht=qr&chl=lgs:${wallet.account.address}&chs=180x180&choe=UTF-8&chld=L%7C2`)
}

methods.withdraw = async (args, message) => {
  let account = args[0]
  if ((account.startsWith('lgs_1') || account.startsWith('lgs_3')) && account.length === 64) {
    const accountCrop = account.replace('lgs_', '')
    const isValid = /^[13456789abcdefghijkmnopqrstuwxyz]+$/.test(accountCrop)
    if (isValid) {
      const authorID = message.author.id
      const wallet = await Accounts.findOrCreateWallet(authorID)
      const totalReason = bigInt(wallet.account.pendingBalance).minus(bigInt('10000000000000000000000'))
      if (totalReason.greater(bigInt('0'))) {
        await wallet.account.createSend([{
          target: account,
          amount: totalReason
        }], true, wallet.rpc)
        message.react('✅')
      } else {
        message.reply('Insufficient balance to withdraw')
      }
    } else {
      message.reply('Invalid Withdraw Addresss')
    }
  } else {
    message.reply('Invalid Withdraw Addresss')
  }
}

methods.tip = async (args, message) => {
  if (!message.mentions.users.size) {
    message.react('❌')
    return message.author.send('You need to tag a user in order to send them Logos!');
  }
  const amount = parseFloat(args[0]);
  if (isNaN(amount)) {
    message.react('❌')
    return message.author.send('Please send amount as the first argument and make sure that it is a valid float.');
  }
  const senderID = message.author.id
  const receiverID = message.mentions.users.first().id
  const senderWallet = await Accounts.findOrCreateWallet(senderID)
  const receiverWallet = await Accounts.findOrCreateWallet(receiverID)
  let amountInReason = RPC.convert.toReason(amount, 'LOGOS')
  if (bigInt(senderWallet.account.pendingBalance).minus('10000000000000000000000').minus(bigInt(amountInReason)).geq(0)) {
    let val = await senderWallet.account.createSend([{
      target: receiverWallet.account.address,
      amount: amountInReason
    }], true, senderWallet.rpc)
    methods.pendingHashes[val.hash] = {amount: amount, message: message}
  } else {
    message.react('❌')
    return message.author.send(`Insufficient Balance to complete this tip!`);
  }
}

methods.tipsplit = async (args, message) => {
  if (!message.mentions.users.size) {
    message.react('❌')
    return message.author.send('You need to tag at least one user in order to send them Logos!');
  }
  const amount = parseFloat(args[0]);
  if (isNaN(amount)) {
    message.react('❌')
    return message.author.send('Please send amount as the first argument and make sure that it is a valid float.');
  }
  const senderID = message.author.id
  const numberOfSends = Math.ceil(message.mentions.users.size / 8)
  const totalFee = bigInt('10000000000000000000000').times(bigInt(numberOfSends))
  const tipAmount = bigInt(RPC.convert.toReason(amount, 'LOGOS')).divide(message.mentions.users.size)
  const senderWallet = await Accounts.findOrCreateWallet(senderID)
  if (bigInt(senderWallet.account.pendingBalance).minus(totalFee).minus(tipAmount).geq(0)) {
    const promises = message.mentions.users.map(async function(user) {
      let wallet = await Accounts.findOrCreateWallet(user.id)
      return wallet.account.address
    })
    let receivers = await Promise.all(promises)
    let transactions = receivers.reduce((all,one,i) => {
      const ch = Math.floor(i/8); 
      all[ch] = [].concat((all[ch]||[]),[{target:one,amount:tipAmount}]); 
      return all
    }, [])
    for (let trans of transactions) {
      let val = await senderWallet.account.createSend(trans, true, senderWallet.rpc)
      methods.pendingHashes[val.hash] = {amount: amount/message.mentions.users.size, message: message}
    }
  } else {
    message.react('❌')
    return message.author.send(`Insufficient Balance to complete this tip!`);
  }
}

methods.help = (args, message) => {
  message.reply(`Available commands:\`\`\`!deposit - deposit Logos into tip bot \n!balance - shows your balance in the tip bot \n!withdraw <address> - The tip bot will send you all your tips to the given address \n!tip <amount> <mention> - sends the amount in Logos to the mentioned person\`\`\``)
}

module.exports = methods
