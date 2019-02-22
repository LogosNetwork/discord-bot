const Discord = require('discord.js')
const client = new Discord.Client()
const { prefix, token } = require('./config.json')
const models = require('./models')
const commands = require('./commands')
const mqtt = require('./services/mqtt')

client.once('ready', () => {
  client.user.setActivity('!help')
	console.log('Ready!')
});

client.on('message', async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  const args = message.content.slice(prefix.length).split(' ');
  const command = args.shift().toLowerCase();

  // If the command was sent directly to the bot
  if (message.channel.type === 'dm') {
    if (command === `balance` || command === `bal`) {
      commands.balance(args, message)
    } else if (command === `deposit`) {
      commands.deposit(args, message)
    } else if (command === `withdraw`) {
      commands.withdraw(args, message)
    } else if (command === `help`) {
      commands.help(args, message)
    }
  } else {
    // The command was sent to the bot's channel
    if (command === `tip`) {
      commands.tip(args, message)
    } else if (command === `tps`) {
      commands.tps(args, message)
    } else if (command === `tipsplit`) {
      commands.tipsplit(args, message)
    } else if (command === `tr` || command === `tiprandom`) {
      commands.tipRandom(args, message)
    }
  }
})

const handleAppExit = (options, err) => {
  if (err) {
    console.log(err.stack)
  }
  if (options.cleanup) {
    console.log('Cleaning up...')
    mqtt.endClient()
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
  mqtt.connectMQTT()
  client.login(token)
})
