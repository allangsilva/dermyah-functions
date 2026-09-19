const User = require('../models/User');

module.exports = async (req, res, next) => {
    
    const { userId } = req.headers;

    const user = await User.findById(userId);

    if( !user ) {
        res.status(403).json({ error: "Erro ao recuperar usuário da sessão" });
    }

    if( user.admin ) 
        return next();

    return res.status(401).json({ error: "Você não tem permissão para fazer isso" });
}