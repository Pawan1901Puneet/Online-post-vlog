const express = require('express');

const mongoose = require('mongoose');
const bodyParser = require('body-parser');


const multer = require('multer')
const { graphqlHTTP } = require('express-graphql');
const graphQLSchema = require('./graphql/schema');
const graphQLResolver = require('./graphql/resolvers');
const auth = require('./util/auth');
const imageUpload = require('./util/image-upload');


const path = require('path');

const MONGODB_URI = 'mongodb+srv://pikku:pikku@cluster0.5i9inji.mongodb.net/Post-feed?retryWrites=true&w=majority';

const storage = multer.diskStorage({
    destination : (req,file,cb) => {
        cb(null,'images');
    },
    filename : (req,file,cb) => {
        cb(null, new Date().toISOString().split(':').join('-') + '-' + file.originalname);
    }
});

const fileFilter = (req,file,cb) => {

    if(file.mimetype == 'image/jpg' || file.mimetype == 'image/jpeg' || file.mimetype == 'image/png')
        cb(null,true);
    else
        cb(null,false); 

}


const app = express();

// we want the data reaching our apis to be json encoded, and not FORM (url) encoded
app.use(bodyParser.json());

app.use(multer({storage : storage,fileFilter:fileFilter}).single('image'));

app.use('/images',express.static(path.join(__dirname,'images')));



app.use((req,res,next) => {

    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');


    // Coz express-graphql automatically blocks this
    // so we need to allow it
    if(req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(auth);
app.put('/image-upload',imageUpload);
app.use('/graphql',graphqlHTTP({
    schema : graphQLSchema,
    rootValue : graphQLResolver,
    graphiql : true,
    customFormatErrorFn(err) {
        if(!err.originalError) {
            return err;
        }

        const message = err.message || 'An error occured!';
        const data = err.originalError.data;
        const statusCode = err.originalError.statusCode || 500;

        return {message : message,data : data,statusCode : statusCode};
    }
}));

//general error middleware-> to catch all the thrown errors
app.use((error,req,res,next) => {
    console.log(error);
    const message = error.message;
    const status = error.statusCode || 500;

    res.status(status).json({
        message : message
    })
})

mongoose.connect(MONGODB_URI).then(res => {
    const server = app.listen(8080);

}).catch(err => console.log(err));

