var Promise = require('promise');
var request = require('request');
var fs = require('fs');

var config = {
    log: false
};


function doRequest(method, params) {
    var url = method.indexOf('http') == -1 ? 'https://api.vk.com/method/' + method : method;
    
    return new Promise(function(resolve, reject) {
        params.access_token = config.token;

        request.post({url: url, formData: params}, function (err, httpResponse, body) {
            if (err) reject(err);
            if (!body) reject('Something went wrong');
        
            var response = JSON.parse(body);

            if (config.log) {
                console.log('------------------------------------');
                console.log('\n')
                console.log('Requesting: ' + url);
                console.log('Response:');
                console.log(response.response)
                console.log('\n')
                console.log('------------------------------------');
                console.log('\n\n\n')
            }
            resolve(response);
        }); 
    })
};

function checkConfig() {
    config = config || {};
    return (config.token && config.groupID);
};

function uploadToAlbum(albumTitle, photo) {
    return photos.getAlbumByName(albumTitle)
        .then(function(album) {
            return photos.getUploadServer(album.aid);
        })
        .then(function(server) {
            var options = photos.getUploadObject(photo.src);

            return doRequest(server.response.upload_url, options)
        })
        .then(function(response) {
            return doRequest('photos.save', {
                album_id: response.aid,
                group_id: config.groupID,
                server: response.server,
                photos_list: response.photos_list,
                hash: response.hash,
                caption: photo.desc
            })
        })
}

var wall = {
    post: function(message, attachments) {
        return doRequest('wall.post', {
            owner_id: -config.groupID,
            from_group: 1,
            message: message,
            attachments: attachments
        })
    }
};

var photos =  {
    getAlbumByName: function(albumTitle) {
        return doRequest('photos.getAlbums', {
            owner_id: -config.groupID,
        })
        .then(function(albumsArray) {
            selectedAlbum = albumsArray.response.filter(function(album) {
                if (album.title === albumTitle)
                    return album;
            });

            return new Promise(function(resolve, reject) {
                if (selectedAlbum.length === 0) {
                    photos.createAlbum(albumTitle).then(function(album) {
                        resolve(album.response);
                    });

                    return;
                }

                resolve(selectedAlbum[0]);
            });
        });
    },

    createAlbum: function(title) {
        return doRequest('photos.createAlbum', {
            title: title,
            privacy: 0,
            gid: config.groupID
        });
    },

    getUploadServer: function(albumID) {
        return doRequest('photos.getUploadServer', {
            album_id: albumID,
            group_id: config.groupID
        })
    },

    getUploadObject: function(photo) {
        var returnObj = {}

        if (photo.indexOf('http') == -1) {
            returnObj['file1'] = fs.createReadStream(photo)
        }
        else {
            returnObj['file1'] = request(photo)
        }

        return returnObj;
    }
};


var methods = {
    config: function(conf) {
        Object.keys(conf).forEach(function(key) {
            config[key] = conf[key];
        });
    },

    groupPost: function(post, photos) {
        var promiseStack = [];

        if (!photos.album || photos.album === '') {
            return new Promise(function(resolve, reject) {
                reject('ERROR: Album name is required');
            });
        }

        if (!checkConfig()) {
            return new Promise(function(resolve, reject) {
                reject('ERROR: token and groupID are required');
            });
        }

        post = post || '';
        photos.list = photos.list || [];

        photos.list.forEach(function(photo) {
            promiseStack.push(uploadToAlbum(photos.album, photo))
        })

        return Promise
            .all(promiseStack)
            .then(function(photos) {
                var attachments = photos.map(function(photo) {
                    return 'photo' + photo.response[0].owner_id.toString() + '_' + photo.response[0].pid
                });

                return wall.post(post, attachments.join(','))
            })
    }
}


module.exports = methods;
