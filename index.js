var Promise = require('promise');
var request = require('request');
var fs = require('fs')

var config = {}

var log = false;

var doRequest = function(method, params) {
	var url = method.indexOf('http') == -1 ? 'https://api.vk.com/method/' + method : method;

	params['access_token'] = config.token;
	
	return new Promise(function(resolve, reject) {

		request.post({url: url, formData: params}, function (err, httpResponse, body) {
			if (err) reject(err);
		
			var response = JSON.parse(body);

			if (log) {
				console.log('------------------------------------');
				console.log('')
				console.log('Requesting: ' + url)
				console.log(response)
				console.log('')
				console.log('------------------------------------');
				console.log('')
			}
			resolve(response);
		});	

	})
};


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
					if (album.title == albumTitle)
						return album;
				});

				return new Promise(function(resolve, reject) {
					if (selectedAlbum.length == 0)
						reject('Альбом с таким именем не найден')

					resolve(selectedAlbum[0]);
				});
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
		config = conf;
	},

	groupPost: function(post, photos) {
		var promiseStack = [];

		photos.list.forEach(function(photo) {
			promiseStack.push(methods.uploadToAlbum(photos.album, photo))
		})

		return Promise.all(promiseStack)
			.then(function(photos) {
				var attachments = photos.map(function(photo) {
					return 'photo' + photo.response[0].owner_id.toString() + '_' + photo.response[0].pid
				});

				return wall.post(post, attachments.join(','))
			})
	},

	uploadToAlbum: function(albumTitle, photo) {
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
	},

}


module.exports = methods;
