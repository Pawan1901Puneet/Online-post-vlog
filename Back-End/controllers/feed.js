const { validationResult } = require('express-validator');
const Post = require('../models/post');
const User = require('../models/user');

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const POSTS_PER_PAGE = 2;

const io = require('../util/socket');


exports.getPosts = async (req,res,next) => {

    const currentPage = +req.query.page || 1;

    try {
    const totalItems = await Post.find().countDocuments();
    
    const posts = await Post
                        .find()
                        .populate('creator')
                        .sort({createdAt : -1})
                        .skip((currentPage - 1)*POSTS_PER_PAGE)
                        .limit(POSTS_PER_PAGE);

        res.status(200).json({
            message : 'success',
            posts : posts,
            totalItems : totalItems
        });
    }
    catch(err) {
        if(!err.statusCode) {
            err.statusCode = 500;
        } 
        next(err);
    };

    /*res.status(200).json({
        posts : [
            {
                _id : '1',
                title : 'First Post',
                content : 'This is the first Post',
                imageUrl : 'images/duck-image.jpg',
                creator : {
                    name : 'Pawan'
                },
                createdAt : new Date()
            }
        ],
        message : 'success'
    });*/
}

exports.createPost = async (req,res,next) => {

    //checking for validation errors
    const errors = validationResult(req);

    if(!errors.isEmpty()) {
        /*return res.status(422).json({
            message : 'Validation Failed,Entered data is incorrect'
        });*/

        //we will not do this manually, but create an
        //error layer above all, to handle all the errors
        const error = new Error('Validation Failed,Entered data is incorrect');
        error.statusCode = 422;
        throw error;
    }

    
    if(!req.file) {

        const error = new Error('No Image Provided');
        error.statusCode = 422;
        throw error;
    }
    

    const image = req.file;

    const title = req.body.title;
    const content = req.body.content;
    const imageUrl = image.path.replace('\\','/');

    //Create Post in Db
    const post = new Post({
        title : title,
        content : content,
        imageUrl : imageUrl,
        // getting userId extracted from the JWT token
        creator : new mongoose.Types.ObjectId(req.userId)
    });

    try {

        const new_post = await post.save();
        const creator = await User.findById(req.userId);

        creator.posts.push(new_post);
        const result = await creator.save();
        
        //arbitary value to send to server
        new_post.creator = creator;
        
        //BROADCAST will send the message to all the connected users
        //except user from which the request was sent

        //EMIT will send the message to all the users
        io.getIO().emit('posts',{
            action : 'create',
            post : new_post
        });


        //sending back the response to the user who created the post
        res.status(201).json({
            message : 'Post created Successfully',
            post : new_post,
            creator : {_id : creator._id , name : creator.name}
        });
    }
    catch(err) {
        if(!err.statusCode) {
            err.statusCode = 500;
        }
        
        next(err);
    };
    
}

exports.getPost = async (req,res,next) => {

    const postId = req.params.postId;

    try {

        const post = await Post.findOne({_id : postId})
        .populate('creator');
    
        res.status(200).json({
            message : 'Post Fetched',
            post : post
        });

    }
    catch(err) {

        if(!err.statusCode) {
            err.statusCode = 500;
        }   
        next(err);
    }
}

exports.editPost = async (req,res,next) => {

    //params + body

     //checking for validation errors
     const errors = validationResult(req);

     if(!errors.isEmpty()) {
        const error = new Error('Validation Failed,Entered data is incorrect');
        error.statusCode = 422;
        throw error;
     }

     const title = req.body.title;
     const content = req.body.content;

     const postId = req.params.postId;
     let imageUrl = req.body.image;

     if(req.file) {
        imageUrl = req.file.path;
     }

     if(!imageUrl) {
        const error = new Error('No file picked');
        error.statusCode = 422;
        throw error;

     }

     imageUrl = imageUrl.replace('\\','/');

    try {

        const post = await Post.findOne({_id : postId}).populate('creator');

        //to check if you're allowed to delete the post
        if(post.creator._id.toString() !== req.userId.toString()) {
            const error = new Error('Not authorized!');
            error.statusCode = 403;
            throw error;
        }

        if(imageUrl !== post.imageUrl)
        {
            deleteImage(post.imageUrl);
        }

        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl;
        
       const result = await post.save();

       console.log(result);

       //emitting to the users
       io.getIO().emit('posts',{
        action : 'update',
        post : result
       });
    
        res.status(200).json({
            message : 'Post edited Successfully',
            post : result
        });
     }
     catch(err) {

        if(!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    };
}

exports.deletePost = async (req,res,next) => {
    const postId = req.params.postId;

    try {

        const post = await Post.findById(postId);
    
        //check for the user if he created the post
        //to check if you're allowed to delete the post
        if(!post.creator.toString() === req.userId.toString()) {
            const error = new Error('Not authorized!');
            error.statusCode = 403;
            throw error;
        }

        //deleting image
        deleteImage(post.imageUrl);

        await Post.findByIdAndRemove(postId);

        const userDoc = await User.findById(req.userId);

        //userDoc.posts = userDoc.posts.filter(p => p.toString() !== postId.toString());
        userDoc.posts.pull(postId);
        const result = await userDoc.save();


        //emitting the message to the users
        io.getIO().emit('posts',{
            action : 'delete',
            post : postId
        });
    
        res.status(200).json({
            message : 'Post Deleted Successfully'
        });
    }
    catch(err){

        if(!err.statusCode) {
            err.statusCode = 500;
        }
        
        next(err);

    };
}



const deleteImage = filePath => {

    filePath = path.join(__dirname,'..',filePath);

    fs.unlink(filePath,(err) => {

        if(err) {
            throw err;
        }
    })

}