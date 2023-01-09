const User = require('../models/user');
const Post = require('../models/post');

const path = require('path');
const fs = require('fs');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const validator = require('validator');
//EXPRESS-VALIDATOR USES VALIDATOR BEHIND THE SCENES
//so validation code would be same

const jwt = require('jsonwebtoken');
const POSTS_PER_PAGE = 2;

const deleteImage = filePath => {

    filePath = path.join(__dirname,'..',filePath);

    fs.unlink(filePath,(err) => {

        if(err) {
            throw err;
        }
    })

}

module.exports = {

    //createUser(args,req)
    //{destructuring}

    //IMPORTANT : IF we use Promises .then().catch()
    // we need to always return our promises
    //because grpahQL won't wait for it to resolve
    //e.g. return User.findOne().then()
    createUser : async function({userInput},req) {

        const errors = [];

        if(!validator.isEmail(userInput.email)) {
            errors.push({message : 'E-mail not valid!'});
        }

        if(validator.isEmpty(userInput.password) || !validator.isLength(userInput.password,{min : 5})) {
            errors.push({message : 'Password too short!'});
        }

        if(errors.length > 0) {
            const error = new Error('Invalid Input!');
            error.data = errors;
            error.statusCode = 422;
            throw error;
        } 

        const existingUser = await User.findOne({email : userInput.email});

        if(existingUser) {
            const error = new Error('User exists already!');
            throw error;
        }

        const hashedPassword = await bcrypt.hash(userInput.password,12);

        const user = new User({
            email : userInput.email,
            password : hashedPassword,
            name : userInput.name
        });

        const createdUser = await user.save();

        // _doc is added, to just get the userData and not the metadata associated with it
        // graphQL overwrites the _id, therefore, to avoid 
        //mismatch of _id values, we add it separately by adding it as a string
        return {...createdUser._doc, _id : createdUser._id.toString() };
    },
    login : async ({ email, password },req) => {

        const user = await User.findOne({email : email});

        if(!user) {
            const error = new Error('User not Found!');
            error.statusCode = 401;
            throw error;
        }

        const doMatch = await bcrypt.compare(password,user.password);

        if(!doMatch) {
            const error = new Error('Password not matching !');
            error.statusCode = 401;
            throw error;

        }

        const token = jwt.sign({
            userId : user._id.toString(),
            email : user.email
        },'ThisIsThePrivateKeyForGraphQL',{
            expiresIn : '1h'
        });

        return {token : token,userId : user._id.toString()};
    },
    createPost : async ({ postInput },req) => {

        if(!req.isAuth) {
            const error = new Error('Not Authenticated!');
            error.statusCode = 401;
            throw error;
        }

        const title = postInput.title;
        const imageUrl = postInput.imageUrl;
        const content = postInput.content;

        //validation
        const errors = [];

        if(validator.isEmpty(title) || !validator.isLength(title,{min : 5})) {
            errors.push({message : 'Title too short!'});
        }

        if(validator.isEmpty(content) || !validator.isLength(content,{min : 5})) {
            errors.push({message : 'Content too short!'});
        }

        if(errors.length > 0) {
            const error = new Error('Invalid Post Input!');
            error.data = errors;
            error.statusCode = 422;
            throw error;
        }

        const currentUser = await User.findById(req.userId);

        if(!currentUser) {
            const error = new Error('User Not found!');
            error.statusCode = 401;
            throw error;
        }

        const post = new Post({
            title : title,
            content : content,
            imageUrl : imageUrl,
            creator : currentUser._id.toString()
        });

        const result = await post.save();

        //adding post to user
        currentUser.posts.push(result._id.toString());
        await currentUser.save();

        return {...result._doc,_id : result._id.toString(),creator : currentUser,createdAt : result.createdAt.toISOString(),updatedAt : result.updatedAt.toISOString()};
    },
    getPosts : async ({ page },req) => {

        if(!req.isAuth) {
            const error = new Error('Not Authenticated!');
            error.statusCode = 401;
            throw error;
        }

        if(!page) {
            page = 1;
        }

        const totalItems = await Post.find().countDocuments();

        const posts = await Post.find().sort({createdAt : -1}).skip((page - 1)*POSTS_PER_PAGE).limit(POSTS_PER_PAGE).populate('creator');

        if(!posts) {
            const error = new Error('Posts Not Found!')
            error.statusCode = 404;
            throw error;
        }

        return {posts : posts.map(post => {
            return {...post._doc,_id : post._id.toString(),createdAt : post.createdAt.toISOString(),updatedAt : post.updatedAt.toISOString()};
        }),totalItems : totalItems};
    },
    getUserData : async (args,req) => {

        if(!req.isAuth) {
            const error = new Error('Not Authenticated!');
            error.statusCode = 401;
            throw error;
        }

        const user = await User.findById(req.userId);

        if(!user) {
            const error = new Error('User Not Found!');
            error.statusCode = 404;
            throw error;
        }


        return {...user,posts : user.posts.map(id => {
            return id.toString();
        })}
    },
    getPost : async ({ postId },req) => {

        if(!req.isAuth) {
            const error = new Error('Not Authenticated!');
            error.statusCode = 401;
            throw error;
        }

        const post = await Post.findById(postId).populate('creator');

        if(!post) {
            const error = new Error('Post Not found!');
            error.statusCode = 404;
            throw error;
        }

        return {...post._doc,_id:post._id.toString(),createdAt : post.createdAt.toISOString(),updatedAt : post.updatedAt.toISOString(),creator : {...post.creator._doc,_id : post.creator._id.toString()}};
    },
    editPost: async ({ postId, postInput },req) => {

        if(!req.isAuth) {
            const error = new Error('Not Authenticated!');
            error.statusCode = 401;
            throw error;
        }

        const post = await Post.findById(postId).populate('creator');

        if(!post) {
            const error = new Error('Post Not found!');
            error.statusCode = 404;
            throw error;
        }

        if(post.creator._id.toString() !== req.userId.toString()) {
            const error = new Error('Not Authorized!');
            error.statusCode = 403;
            throw error;
        }
        
        
        const title = postInput.title;
        const imageUrl = postInput.imageUrl;
        const content = postInput.content;

        //validation
        const errors = [];

        if(validator.isEmpty(title) || !validator.isLength(title,{min : 5})) {
            errors.push({message : 'Title too short!'});
        }

        if(validator.isEmpty(content) || !validator.isLength(content,{min : 5})) {
            errors.push({message : 'Content too short!'});
        }

        if(errors.length > 0) {
            const error = new Error('Invalid Post Input!');
            error.data = errors;
            error.statusCode = 422;
            throw error;
        }

        //now check for file presence
        post.title = title;
        post.content = content;
        if(postInput.imageUrl !== 'undefined') {
            post.imageUrl = imageUrl
        }

        const updatedPost = await post.save();

        return {...updatedPost._doc,_id:updatedPost._id.toString(),createdAt : updatedPost.createdAt.toISOString(),updatedAt : updatedPost.updatedAt.toISOString()};

    },
    deletePost : async ({postId},req) => {

        if(!req.isAuth) {
            const error = new Error('Not Authenticated!');
            error.statusCode = 401;
            throw error;
        }

        const post = await Post.findById(postId);

        if(!post) {
            const error = new Error('Post Not found!');
            error.statusCode = 404;
            throw error;
        }

        if(post.creator.toString() !== req.userId.toString()) {
            const error = new Error('Not Authorized!');
            error.statusCode = 403;
            throw error;
        }

        deleteImage(post.imageUrl);

        await Post.findByIdAndRemove(postId);

        const user = await User.findById(req.userId);

        user.posts.pull(postId);
        await user.save();

        return true;
    },
    getUser : async (args,req) => {

        if(!req.isAuth) {
            const error = new Error('Not Authenticated!');
            error.statusCode = 401;
            throw error;
        }

        const user = await User.findById(req.userId);

        if(!user) {
            const error = new Error('User Not found!');
            error.statusCode = 404;
            throw error;
        }

        return {...user._doc,_id : user._id.toString()};
    },
    updateStatus : async ({ status },req) => {

        if(!req.isAuth) {
            const error = new Error('Not Authenticated!');
            error.statusCode = 401;
            throw error;
        }

        //validation 
        if(validator.isEmpty(status)) {
            const error = new Error('Invalid Input!');
            error.statusCode = 422;
            throw error;
        }

        const user = await User.findById(req.userId);

        if(!user) {
            const error = new Error('User Not found!');
            error.statusCode = 404;
            throw error;
        }

        user.status = status;
        const updatedUser = await user.save();

        return {...updatedUser._doc,_id : updatedUser._id.toString()}

    }
};