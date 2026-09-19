const Yup = require('yup');
const mongoose = require('mongoose');

const User = require('../models/User');
const Print = require('../models/PrintResult');

class PrintController {
    async save(req, res) {
        const schema = Yup.object().shape({
            userId: Yup.string().required(),
            classification: Yup.string().required()
        });

        if( !mongoose.Types.ObjectId.isValid(req.body.userId) ) {
            return res.status(400).json({ message: "ID do usuário inválido" });
        }
    
        if (!(await schema.isValid(req.body))) {
            return res.status(400).json({ message: 'Erro na validação dos campos enviados' });
        }

        const userExists = await User.findById(mongoose.Types.ObjectId(req.body.userId));

        if( !userExists ) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const print = await Print.create(req.body);

        return res.json(print);
    }

    async get(req, res) {

        const { start, end } = req.query;

        let conditions = {};
        if( start ) {
            conditions.createdAt = { "$gte": start }
        }

        if( end ) {
            if( !start ) conditions.createdAt = { "$gte": "2001-01-01" }
            conditions.createdAt.$lt = end;
        }

        console.log('conditions', conditions);

        const prints = await Print.find(conditions);
        return res.json(prints);
    }
}

module.exports = new PrintController();