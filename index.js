const Discord = require('discord.js')
const client = new Discord.Client()
const { prefix, token, mqttSettings } = require('./config.json')
const bigInt = require('big-integer')
const mqtt = require('mqtt')
const mqttRegex = require('mqtt-regex')
const models = require('./models')
const Accounts = require('./services/accounts')
const Logos = require('@logosnetwork/logos-rpc-client')
const RPC = new Logos({ url: `http://100.25.175.142:55000`, debug: false })

let pendingHashes = {}

client.once('ready', () => {
  client.user.setActivity('!help')
	console.log('Ready!')
});

client.on('message', async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  const args = message.content.slice(prefix.length).split(' ');
  const command = args.shift().toLowerCase();

  if (message.channel.type === 'dm') {
    if (command === `balance` || command === `bal`) {
      const authorID = message.author.id
      const wallet = await Accounts.findOrCreateWallet(authorID)
      message.reply(`Your balance is ${RPC.convert.fromReason(wallet.account.pendingBalance, 'LOGOS')} Logos`)
    } else if (command === `deposit`) {
      const authorID = message.author.id
      const wallet = await Accounts.findOrCreateWallet(authorID)
      message.reply(`Your wallet address is ${wallet.account.address} \n QR: https://chart.googleapis.com/chart?cht=qr&chl=lgs:${wallet.account.address}&chs=180x180&choe=UTF-8&chld=L%7C2`)
    } else if (command === `withdraw`) {
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
    } else if (command === `help`) {
      message.reply(`Available commands:\`\`\`!deposit - deposit Logos into tip bot \n!balance - shows your balance in the tip bot \n!withdraw <address> - The tip bot will send you all your tips to the given address \n!tip <amount> <mention> - sends the amount in Logos to the mentioned person\`\`\``)
    }
  } else {
    if (command === `tip`) {
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
        pendingHashes[val.hash] = message
      } else {
        message.react('❌')
        return message.author.send(`Insufficient Balance! You tried send ${amount} Logos, but you only have ${RPC.convert.fromReason(senderWallet.account.pendingBalance, 'LOGOS')} Logos`);
      }
    } else if (command === `tps`) {

    }
  }
})

let mqttClient = null

// MQTT Client
const broadcastMqttRegex = mqttRegex('transaction/+hash').exec
const connectMQTT = () => {
  mqttClient = mqtt.connect(mqttSettings.url, mqttSettings.options)
  mqttClient.on('connect', () => {
    console.log('connected')
    subscribe()
  })

  mqttClient.on('message', async (topic, content) => {
    let params = broadcastMqttRegex(topic)
    if (params) {
      let hash = params.hash
      if (pendingHashes[hash] !== undefined) {
        let message = pendingHashes[hash]
        const args = message.content.slice(prefix.length).split(' ');
        await message.react('✅')
        message.mentions.users.first().send(`You have recieved a tip of ${args[1]} Logos from ${message.author.username}! \n Type !balance to check your balance.`)
      }
    }
  })
}

let subscribed = false
const subscribe = () => {
  if (!subscribed) {
    mqttClient.subscribe('transaction/#')
    console.log('Subscribed to transactions')
    subscribed = true
  }
}

const handleAppExit = (options, err) => {
  if (err) {
    console.log(err.stack)
  }
  if (options.cleanup) {
    console.log('Cleaning up...')
    if (mqttClient) {
      mqttClient.end(true)
    }
  }
  if (options.exit) {
    console.log('Calling exit...')
    process.exit()
  }
}

const configureSignals = () => {
  process.on('exit', handleAppExit.bind(null, {
    cleanup: true
  }))
  process.on('SIGINT', handleAppExit.bind(null, {
    exit: true
  }))
  process.on('uncaughtException', handleAppExit.bind(null, {
    exit: true
  }))
}

models.sequelize.sync().then(() => {
  configureSignals()
  connectMQTT()
  client.login(token)
})
