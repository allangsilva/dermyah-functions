const Yup = require('yup');

const User = require('../models/User');
const Print = require('../models/PrintResult');
const { convertTimestamps } = require('../database/firestoreModel');

class PrintController {
    async save(req, res) {
        const schema = Yup.object().shape({
            userId: Yup.string().required(),
            classification: Yup.string().required()
        });

        if (!(await schema.isValid(req.body))) {
            return res.status(400).json({ message: 'Erro na validação dos campos enviados' });
        }

        const userExists = await User.findById(req.body.userId);

        if( !userExists ) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const print = await Print.create(req.body);

        return res.json(print);
    }

    async get(req, res) {

        const { start, end } = req.query;

        let query = Print.collection();
        if( start ) {
            query = query.where('createdAt', '>=', new Date(start));
        }

        if( end ) {
            if( !start ) query = query.where('createdAt', '>=', new Date('2001-01-01'));
            query = query.where('createdAt', '<', new Date(end));
        }

        console.log('range', { start, end });

        const snapshot = await query.get();
        const prints = snapshot.docs.map((doc) => convertTimestamps({ id: doc.id, ...doc.data() }));
        return res.json(prints);
    }
}

module.exports = new PrintController();