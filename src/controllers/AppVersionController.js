const Yup = require('yup');

const AppVersion = require('../models/AppVersion');

class AppVersionController {
    async update(req, res) {
        try{
            const schema = Yup.object().shape({
                platforms: Yup.array().required()
            });

            if (!(await schema.isValid(req.body))) {
                return res.status(400).json({ message: 'Erro na validação dos campos enviados.' });
            }

            const { platforms } = req.body;

            for( const platformItem of platforms ) {

                const { platform, versionNumber } = platformItem;
    
                const appVersionDoc = await AppVersion.findOne({ platform });
    
                if( !appVersionDoc ) {
                    return res.status(404).json({ message: "Nome da plataforma é inválido" });
                }
    
                appVersionDoc.versionNumber = versionNumber;
                await appVersionDoc.save();
            }

            return res.json({ success: true });
        } catch(error) {
            console.error('ERROR ON UPDATE - ', error);
            return res.status(500).json({ message: "Erro ao salvar item", error });
        }
    }

    async get(req, res) {
        try {

            const { platform } = req.params;
            
            let result = null;
            if( !platform ) {
                // get all
                result = await AppVersion.find({});
            } else {
                result = await AppVersion.findOne({ platform });
            }
    
            return res.json(result);
        } catch(error) {
            console.error('ERROR ON GET - ', error);
            return res.status(500).json({ message: "Erro ao recuperar item", error });
        }
    }
}

module.exports = new AppVersionController();