const mongoose = require('mongoose');

class Database {
    constructor() {
        this.init();
    }

    init() {
        this.mongoConnection = mongoose.connect(process.env.MONGO_URL, {
            useNewUrlParser: true,
            useFindAndModify: true
        });
        
        this.mongoConnection.then((res) => {
            console.log('[MONGO] - Connection Successfully');
        });
    }

    
}

module.exports = new Database();