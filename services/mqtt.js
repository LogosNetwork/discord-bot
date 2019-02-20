const mqtt = require('mqtt')
const mqttRegex = require('mqtt-regex')
const { prefix, mqttSettings } = require('../config.json')
const commands = require('../commands/index')

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
        data.message.mentions.users.tap(user => {
          user.send(`You have recieved a tip of ${data.amount} Logos from ${data.message.author.username}! \n Type !balance to check your balance.`)
        })
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
