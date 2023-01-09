import React, { Component, Fragment } from 'react';
//import OpenSocket from 'socket.io-client';

import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import './Feed.css';

class Feed extends Component {
  state = {
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: '',
    postPage: 1,
    postsLoading: true,
    editLoading: false
  };

  componentDidMount() {
    let graphQLQuery = {
      query : `
        query {
          getUser {
            status
          }
        }
      `
    };

    fetch('http://localhost:8080/graphql',{
      method : 'POST',
      headers : {
        Authorization : 'Bearer ' + this.props.token,
        'Content-Type' : 'application/json'
      },
      body : JSON.stringify(graphQLQuery)
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        this.setState({ status: resData.data.getUser.status });
      })
      .catch(this.catchError);

    this.loadPosts();
    //providing the server on which we want to establish
    //web socket
    /*const socket = OpenSocket('http://localhost:8080');
    socket.on('posts',data => {
      if(data.action === 'create') {
        this.addPost(data.post);
      }
      else if(data.action === 'update') {
        this.updatePost(data.post);
      }
      else if(data.action === 'delete') {
        this.loadPosts();
      }
    });*/
  }

  /*addPost = post => {
    this.setState(prevState => {
      const updatedPosts = [...prevState.posts];
      if (prevState.postPage === 1) {
        if (prevState.posts.length >= 2) {
          updatedPosts.pop();
        }
        updatedPosts.unshift(post);
      }
      return {
        posts: updatedPosts,
        totalPosts: prevState.totalPosts + 1
      };
    });

  };

  updatePost = post => {
    this.setState(prevState => {
      const updatedPosts = [...prevState.posts];
      const updatedPostIndex = updatedPosts.findIndex(p => p._id === post._id);
      if (updatedPostIndex > -1) {
        updatedPosts[updatedPostIndex] = post;
      }
      return {
        posts: updatedPosts
      };
    });
  };*/

  loadPosts = direction => {
    if (direction) {
      this.setState({ postsLoading: true, posts: [] });
    }
    let page = this.state.postPage;
    if (direction === 'next') {
      page++;
      this.setState({ postPage: page });
    }
    if (direction === 'previous') {
      page--;
      this.setState({ postPage: page });
    }

    const graphQLQuery = {
      query : `
        query FetchPosts($page : Int!) {
          getPosts(page : $page) {
            posts {
              _id
              title
              content
              creator {
                name
              }
              createdAt
              updatedAt
            }
            totalItems
          }
        }
      `,variables : {
        page : page
      }
    };

    fetch('http://localhost:8080/graphql',{
      method : 'POST',
      headers : {
        Authorization : 'Bearer ' + this.props.token,
        'Content-Type' : 'application/json'
      },
      body : JSON.stringify(graphQLQuery)
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {

        if(resData.errors) {
          const error = new Error('fetching posts failed!');
          throw error;
        }

        resData = resData.data.getPosts;

        console.log(resData);
        this.setState({
          posts: resData.posts.map(post => {
            return {
              ...post,
              imagePath : post.imageUrl
            }
          }),
          totalPosts: resData.totalItems,
          postsLoading: false
        });
      })
      .catch(this.catchError);
  };

  statusUpdateHandler = event => {
    event.preventDefault();
    //const updatedStatus = event.target.querySelector('[type=text]').value;
    //console.log(updatedStatus);
    let graphQLQuery = {
      query : `
        mutation {
          updateStatus(status : "${this.state.status}") {
            _id
            status
            name
          }
        }
      `
    };
    fetch('http://localhost:8080/graphql',{
      method : 'POST',
      body : JSON.stringify(graphQLQuery),
      headers : {
        Authorization : 'Bearer ' + this.props.token,
        'Content-Type' : 'application/json'
      }
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        console.log(resData);
      })
      .catch(this.catchError);
  };

  newPostHandler = () => {
    this.setState({ isEditing: true });
  };

  startEditPostHandler = postId => {
    this.setState(prevState => {
      const loadedPost = { ...prevState.posts.find(p => p._id === postId) };

      return {
        isEditing: true,
        editPost: loadedPost
      };
    });
  };

  cancelEditHandler = () => {
    this.setState({ isEditing: false, editPost: null });
  };

  finishEditHandler = postData => {
    this.setState({
      editLoading: true
    });

    // Set up data (with image!)
    const formData = new FormData();
    formData.append('image',postData.image);

    if(this.state.editPost) {
      formData.append('oldPath',this.state.editPost.imagePath);
    }

    /*if (this.state.editPost) {
      url = 'http://localhost:8080/feed/post/' + this.state.editPost._id;
      method = 'PUT';
    }*/

    fetch('http://localhost:8080/image-upload',{
      method: 'PUT',
      headers : {
        Authorization : 'Bearer ' + this.props.token,
      },
      body : formData
    }).then(res => res.json())
    .then(fileResData => {
      
      let imageUrl;
      if(fileResData.filePath) {
        imageUrl = fileResData.filePath.replace('\\','/');
      }
      let graphQLQuery;
      
      if(this.state.editPost) {

        graphQLQuery = {
          query : `
            mutation {
              editPost(postId : "${this.state.editPost._id}",postInput : {title : "${postData.title}", content : "${postData.content}", imageUrl : "${imageUrl}"}) {
                _id
                title
                content
                imageUrl
                createdAt
                creator {
                  _id
                  name
                }
              }
            }
          `
        };
      }
      else
      {
        graphQLQuery = {
          query : `
            mutation {
              createPost(postInput : {title : "${postData.title}", imageUrl : "${imageUrl}", content : "${postData.content}"}) {
                _id
                title
                content
                imageUrl
                createdAt
                creator {
                  _id
                  name
                }
              }
            }
          `   
      };
    }

    return fetch('http://localhost:8080/graphql',{
      method : 'POST',
      body : JSON.stringify(graphQLQuery),
      headers : {
        Authorization : 'Bearer ' + this.props.token,
        'Content-Type' : 'application/json'
      }
      });
    }).then(res => {
        return res.json();
      })
      .then(resData => {

        if(resData.errors && resData.errors[0].statusCode === 422) {
          throw new Error(
            "Invalid Input"
          );
        }

        if(resData.errors) {
          throw new Error('Post Creation failed!');
        }

        if(this.state.editPost) {
          resData = resData.data.editPost;
        }
        else
        {
          resData = resData.data.createPost;
        }

        console.log(resData);
        const post = {
          _id: resData._id,
          title: resData.title,
          content: resData.content,
          creator: resData.creator,
          createdAt: resData.createdAt,
          imagePath : resData.imageUrl
        };
        this.setState(prevState => {
          let updatedPosts = [...prevState.posts];
          let updatedTotalPosts = prevState.totalPosts;
          if (prevState.editPost) {
              const postIndex = prevState.posts.findIndex(
                  p => p._id === prevState.editPost._id
              );
              updatedPosts[postIndex] = post;
          } else {
              updatedTotalPosts++;
              if (prevState.posts.length >= 2) {
                  updatedPosts.pop();
              }
              updatedPosts.unshift(post);
          }
          return {
              posts: updatedPosts,
              isEditing: false,
              editPost: null,
              editLoading: false,
              totalPosts : updatedTotalPosts
          };
      });
      })
      .catch(err => {
        console.log(err);
        this.setState({
          isEditing: false,
          editPost: null,
          editLoading: false,
          error: err
        });
      });
  };

  statusInputChangeHandler = (input, value) => {
    this.setState({ status: value });
  };

  deletePostHandler = postId => {
    this.setState({ postsLoading: true });
    let graphQLQuery = {
      query :  `
        mutation {
          deletePost(postId : "${postId}")
        }
      `
    };
    fetch('http://localhost:8080/graphql',{
      method : 'POST',
      headers : {
        Authorization : 'Bearer ' + this.props.token,
        'Content-Type' : 'application/json'
      },
      body : JSON.stringify(graphQLQuery)
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {

        if(resData.errors) {
          throw new Error('Post Creation failed!');
        }
        console.log(resData);
        this.loadPosts();
        // this.setState(prevState => {
        //   const updatedPosts = prevState.posts.filter(p => p._id !== postId);
        //   return { posts: updatedPosts, postsLoading: false };
        // });
      })
      .catch(err => {
        console.log(err);
        this.setState({ postsLoading: false });
      });
  };

  errorHandler = () => {
    this.setState({ error: null });
  };

  catchError = error => {
    this.setState({ error: error });
  };

  render() {
    return (
      <Fragment>
        <ErrorHandler error={this.state.error} onHandle={this.errorHandler} />
        <FeedEdit
          editing={this.state.isEditing}
          selectedPost={this.state.editPost}
          loading={this.state.editLoading}
          onCancelEdit={this.cancelEditHandler}
          onFinishEdit={this.finishEditHandler}
        />
        <section className="feed__status">
          <form onSubmit={this.statusUpdateHandler}>
            <Input
              type="text"
              placeholder="Your status"
              control="input"
              onChange={this.statusInputChangeHandler}
              value={this.state.status}
            />
            <Button mode="flat" type="submit">
              Update
            </Button>
          </form>
        </section>
        <section className="feed__control">
          <Button mode="raised" design="accent" onClick={this.newPostHandler}>
            New Post
          </Button>
        </section>
        <section className="feed">
          {this.state.postsLoading && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Loader />
            </div>
          )}
          {this.state.posts.length <= 0 && !this.state.postsLoading ? (
            <p style={{ textAlign: 'center' }}>No posts found.</p>
          ) : null}
          {!this.state.postsLoading && (
            <Paginator
              onPrevious={this.loadPosts.bind(this, 'previous')}
              onNext={this.loadPosts.bind(this, 'next')}
              lastPage={Math.ceil(this.state.totalPosts / 2)}
              currentPage={this.state.postPage}
            >
              {this.state.posts.map(post => (
                <Post
                  key={post._id}
                  id={post._id}
                  author={post.creator.name}
                  date={new Date(post.createdAt).toLocaleDateString('en-US')}
                  title={post.title}
                  image={post.imageUrl}
                  content={post.content}
                  onStartEdit={this.startEditPostHandler.bind(this, post._id)}
                  onDelete={this.deletePostHandler.bind(this, post._id)}
                />
              ))}
            </Paginator>
          )}
        </section>
      </Fragment>
    );
  }
}

export default Feed;
