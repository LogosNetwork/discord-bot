module.exports = (sequelize, DataTypes) => {
  const account = sequelize.define('account', {
    discord_id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    wallet: {
      type: DataTypes.STRING(576),
      require: true
    }
  }, {
    freezeTableName: true
  })
  return account
}
