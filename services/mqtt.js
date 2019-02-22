const mqtt = require('mqtt')
const mqttRegex = require('mqtt-regex')
const { mqttSettings } = require('../config.json')
const commands = require('../commands/index')
const Accounts = require('./accounts')

let methods = {}
let mqttClient = null
let subscribed = false

// MQTT Client
const broadcastMqttRegex = mqttRegex('transaction/+hash').exec
methods.connectMQTT = () => {
  mqttClient = mqtt.connect(mqttSettings.url, mqttSettings.options)
  mqttClient.on('connect', () => {
    console.log('connected')
    methods.subscribe()
  })

  mqttClient.on('message', async (topic, content) => {
    let params = broadcastMqttRegex(topic)
    if (params) {
      let hash = params.hash
      if (commands.pendingHashes[hash] !== undefined) {
        let data = commands.pendingHashes[hash]
        await data.message.react('✅')
        if (data.receiverID) {
          const isOnboarded = await Accounts.isOnboarded(data.receiverID)
          if (!isOnboarded) {
            data.message.guild.members.get(data.receiverID).send(`Welcome to Logos, a decentralized transaction network designed for high scalability!\n\nLogos is currently in development, but the testnet is up and running. To get you started, ${data.message.author.username} sent you ${data.amount} Logos. To participate on the testnet, visit <https://pla.bs/manual> if you want to create a wallet we have an iOS TestFlight Mobile App <https://testflight.apple.com/join/FX7itRuq>.\n\nFor more information on the project, I’ll provide you with some resources:\nWebsite: <https://logos.network>\nWhitepaper: <https://logos.network/whitepaper>\nFAQ: Coming Soon\nMedium Page: <https://medium.com/logos-network/>\nTwitter: <https://twitter.com/LogosPayments>\n\nIf you have any questions, don’t hesitate to reach out to one of the Logos team members on Discord!`)
            Accounts.onboard(data.receiverID)
          } else {
            user.send(`You have recieved a tip of ${data.amount} Logos from ${data.message.author.username}! \nhttps://logostest.net/${hash} \nType !balance to check your balance.`)
          }
        } else {
          data.message.mentions.users.tap(async user => {
            const isOnboarded = await Accounts.isOnboarded(user.id)
            if (!isOnboarded) {
              user.send(`Welcome to Logos, a decentralized transaction network designed for high scalability!\n\nLogos is currently in development, but the testnet is up and running. To get you started, ${data.message.author.username} sent you ${data.amount} Logos. To participate on the testnet, visit <https://pla.bs/manual> if you want to create a wallet we have an iOS TestFlight Mobile App <https://testflight.apple.com/join/FX7itRuq>.\n\nFor more information on the project, I’ll provide you with some resources:\nWebsite: <https://logos.network>\nWhitepaper: <https://logos.network/whitepaper>\nFAQ: Coming Soon\nMedium Page: <https://medium.com/logos-network/>\nTwitter: <https://twitter.com/LogosPayments>\n\nIf you have any questions, don’t hesitate to reach out to one of the Logos team members on Discord!`)
              Accounts.onboard(user.id)
            } else {
              user.send(`You have recieved a tip of ${data.amount} Logos from ${data.message.author.username}! \nhttps://logostest.net/${hash} \nType !balance to check your balance.`)
            }
          })
        }
      }
    }
  })
}

methods.subscribe = () => {
  if (!subscribed) {
    mqttClient.subscribe('transaction/#')
    console.log('Subscribed to transactions')
    subscribed = true
  }
}

methods.endClient = () => {
  if (mqttClient) {
    mqttClient.end(true)
  }
}

module.exports = methods
