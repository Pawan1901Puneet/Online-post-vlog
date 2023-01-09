const fs = require('fs');
const path = require('path');

module.exports = (req,res,next) => {

    if(!req.isAuth) {
        const error = new Error('Not Authenticated!');
        error.statusCode = 401;
        throw error;
    }

    if(!req.file) {
        return res.status(200).json({message : 'No file Provided'});
    }

    if(req.body.oldPath) {
        deleteImage(req.body.oldPath);
    }

    return res.status(201).json({message : 'File Stored',filePath : req.file.path});
};

const deleteImage = filePath => {

    filePath = path.join(__dirname,'..',filePath);

    fs.unlink(filePath,(err) => {

        if(err) {
            throw err;
        }
    })

}