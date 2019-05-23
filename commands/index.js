let methods = {}
const Accounts = require('../services/accounts')
const Logos = require('@logosnetwork/logos-rpc-client')
const bigInt = require('big-integer')

methods.pendingHashes = {}

methods.balance = async (args, message) => {
  // Grab the id of the author of the message
  const authorID = message.author.id
  
  // Load the users wallet
  const wallet = await Accounts.findOrCreateWallet(authorID)

  // Tell the user their balance
  message.reply(`Your balance is ${Logos.convert.fromReason(wallet.account.pendingBalance, 'LOGOS')} Logos \nView your account here: https://pla.bs/${wallet.account.address}`)
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
        await wallet.account.createSendRequest([{
          destination: account,
          amount: totalReason
        }])
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

methods.tip = async (args, message, receiverID = null) => {
  // Check if the message contains a receiver
  if (!message.mentions.users.size && receiverID === null) {
    message.react('❌')
    return message.author.send('You need to tag a user in order to send them Logos!');
  }

  // Check that they sent a valid amount
  const amount = parseFloat(args[0]);
  if (isNaN(amount) || amount <= 0) {
    message.react('❌')
    return message.author.send('Please send amount as the first argument and make sure that it is a valid float.');
  }

  // The ID of the sender
  const senderID = message.author.id

  // The ID of the receiver
  if (receiverID === null) receiverID = message.mentions.users.first().id

  // Pull both users wallets
  const senderWallet = await Accounts.findOrCreateWallet(senderID)
  const receiverWallet = await Accounts.findOrCreateWallet(receiverID)

  // Calculate the amount to send in Reason which is the smallest division of Logos
  let amountInReason = Logos.convert.toReason(amount, 'LOGOS')

  // Check pending balance in the senders wallet is greater than the amount they are trying to including the transaction fee
  if (bigInt(senderWallet.account.pendingBalance).minus('10000000000000000000000').minus(bigInt(amountInReason)).lt(0)) {
    message.react('❌')
    return message.author.send(`Insufficient Balance to complete this tip!`);
  }

  // Create the send using the webwallet SDK
  let val = await senderWallet.account.createSendRequest([{
    destination: receiverWallet.account.address,
    amount: amountInReason
  }])

  // Save the hash so we can mark it as confirmed later
  methods.pendingHashes[val.hash] = {amount: amount, message: message, receiverID: receiverID}
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
  const tipAmount = bigInt(Logos.convert.toReason(amount, 'LOGOS')).divide(message.mentions.users.size)
  const senderWallet = await Accounts.findOrCreateWallet(senderID)
  if (bigInt(senderWallet.account.pendingBalance).minus(totalFee).minus(tipAmount).geq(0)) {
    const promises = message.mentions.users.map(async function(user) {
      let wallet = await Accounts.findOrCreateWallet(user.id)
      return wallet.account.address
    })
    let receivers = await Promise.all(promises)
    let transactions = receivers.reduce((all,one,i) => {
      const ch = Math.floor(i/8); 
      all[ch] = [].concat((all[ch]||[]),[{destination:one,amount:tipAmount}]); 
      return all
    }, [])
    for (let trans of transactions) {
      let val = await senderWallet.account.createSendRequest(trans)
      methods.pendingHashes[val.hash] = {amount: amount/message.mentions.users.size, message: message}
    }
  } else {
    message.react('❌')
    return message.author.send(`Insufficient Balance to complete this tip!`);
  }
}

methods.tipRandom = (args, message) => {
  let users = []
  let discordAccount = null
  message.guild.members.tap(GuildMember => {
    if (message.author.id !== GuildMember.id &&
      GuildMember.lastMessage &&
      Date.now() - GuildMember.lastMessage.createdTimestamp < 1800000) {
        users.push(GuildMember)
    }
  })
  if (users.length > 0) {
    discordAccount = users[Math.floor(Math.random()*users.length)]
    methods.tip(args, message, discordAccount.id)
  } else {
    message.react('❌')
    return message.author.send(`No one has been active in the last 30 minutes. Try tipping someone directly!`);
  }
}

methods.help = (args, message) => {
  message.reply(`Available commands:\`\`\`!deposit - deposit Logos into tip bot \n!balance - shows your balance in the tip bot \n!withdraw <address> - The tip bot will send you all your tips to the given address \n!tip <amount> <mention> - sends the amount in Logos to the mentioned person \n!tipsplit <amount> <mention>[] - tip split will split the tip amount amongst all the mentioned peopled evenly.\`\`\``)
}

module.exports = methods
