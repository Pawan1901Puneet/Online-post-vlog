const { buildSchema } = require('graphql');

module.exports = buildSchema(`

    type Post {
        _id : ID!
        title : String!
        content : String!
        imageUrl : String!
        creator : User!
        createdAt : String!
        updatedAt : String!
    }

    type User {
        _id : ID!
        name : String!
        email : String!
        password : String
        status : String!
        posts : [Post!]!
    }

    input UserData {
        email : String!
        name : String!
        password : String!
    }

    input PostData {
        title : String!
        content : String!
        imageUrl : String!
    }

    type AuthData {
        token : String!
        userId : String!
    }

    type GetPostsData {
        posts : [Post!]!
        totalItems : Int!
    }

    type Query {
        login(email : String!, password : String!) : AuthData!
        getPosts(page : Int!): GetPostsData!
        getUserData : User!
        getPost(postId : ID!) : Post!
        getUser : User!
    }

    type Mutation {
        createUser(userInput : UserData) : User!
        createPost(postInput : PostData) : Post!
        editPost(postId : ID!, postInput : PostData) : Post!
        deletePost(postId : ID!) : Boolean!
        updateStatus(status : String!) : User!
    }

    schema {
        query : Query
        mutation : Mutation
    }
`);