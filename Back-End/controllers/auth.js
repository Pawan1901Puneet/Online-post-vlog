const User = require('../models/user');
const { validationResult } = require('express-validator');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.Signup = async (req,res,next) => {

    const errors = validationResult(req);

    if(!errors.isEmpty()) {

        const error = new Error('Invalid Information filled.');
        error.statusCode = 422;
        error.data = errors.array();
        throw error;
    }

    const email = req.body.email;
    const password = req.body.password;
    const name = req.body.name;

    try {

        const hashedPassword = await bcrypt.hash(password,12);
        
        const user = new User({
            email : email,
            name : name,
            password : hashedPassword,
            posts : []
        });

        const result = await user.save();
        
        
            
        res.status(201).json({
            message : 'User Created',
            userId : result._id
        });
    }
    catch(err) {
        if(!err.statusCode) {
            err.statucCode = 500;
        }
        next(err);
    }

}

exports.Login = async (req,res,next) => {

    const errors = validationResult(req);

    if(!errors.isEmpty()) {
        const error = new Error('Validation Failed');
        error.statusCode = 422;
        throw error;
    }

    const email = req.body.email;
    const password = req.body.password;

    try {

        const user = await User.findOne({email : email});
        
        const doMatch = await bcrypt.compare(password,user.password);

   
        if(!doMatch) {
            const error = new Error('Wrong Password!');
            error.statusCode = 401;
            throw error;
        }

        //authentication successful, 
        //send the JWT Token to the client

        //Sign uses some JSON Data + some signature(private key) to generate the token
        const token = jwt.sign({
                email : user.email,
                userId : user._id.toString()
            },
            'ThisIsTheSignatureForServerToGenerateJWT',
            {expiresIn : '1h'}
        );

        res.status(200).json({
            message : 'Login Success',
            token : token,
            userId : user._id.toString()
        });
    }
    catch(err) {
        if(!err.statusCode) {
            err.statucCode = 500;
        }
        next(err);
    }

}


exports.getStatus = async (req,res,next) => {


    try {
        //getting the status of the User'
        const user = await User.findById(req.userId);
        

        res.status(200).json({
            message : 'Fetched Status Sucess',
            status : user.status
        });

    }
    catch(err) {

        if(!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);

    };
}


exports.postStatus = async (req,res,next) => {

    const errors = validationResult(req);

    if(!errors.isEmpty()) {
        const error = new Error('Validation Failed,Entered data is incorrect');
        error.statusCode = 422;
        throw error;
    }

    const updatedStatus = req.body.updatedStatus;
    try {
        const user = await User.findById(req.userId)
       
        user.status = updatedStatus;
        const result = await user.save();
        
        
        res.status(200).json({
            message : 'Status Updated',
            status : result.status
        });
    }
    catch(err) {
        if(!err.statucCode) {
            err.statucCode = 500;
        }
        next(err);
    }
}

