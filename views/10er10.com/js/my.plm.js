define(["js/domReady","js/d10.templates", "js/d10.rest", "js/d10.dnd","js/playlist", "js/user", "js/d10.router","js/my", "js/d10.events", "js/d10.toolbox"],
	   function(foo, tpl, rest, dnd, playlist, user, router, myCtrl, pubsub, utils) {

function playlistManager (mydiv,mypldiv) {
	var that = this;
	var plmUpdateTimeout = null;

//   $(document).bind('rplRenameResponse',function(e,data) {		rplRenameResponseHandler(data);	});
  pubsub.topic('rplRenameSuccess').subscribe(function(data) {    rplRenameSuccessHandler(data);	});

//   $(document).bind('rplDropResponse',function(e,data) {		rplDropResponseHandler(data);	});
  pubsub.topic('rplDropSuccess').subscribe(function(data) {		rplDropSuccessHandler(data);	});

	/*
	
		when appending a song (json object) to an rpl
		
		
	*/
	var _appendSong = function(song, pldiv,index) {
		if ( typeof index == 'undefined' || 
					index > $('.list',pldiv).children().length || 
					index < 0 )	 {
			index = $('.list',pldiv).children().length;
		}
		var songtpl = null;
		if ( song._id ) { songtpl = $(tpl.song_template(song)); } 
		else { songtpl = song; }

		var nextOne = $('.list',pldiv).children().eq(index);
		if ( nextOne.length ) { songtpl.insertBefore( nextOne ); } 
		else { songtpl.appendTo( $('.list',pldiv) ); }

		if ( !$('.empty',pldiv).hasClass("hidden") ) {
			$('.empty',pldiv).addClass("hidden");
		}
		if ( $('.list',pldiv).hasClass("hidden") ) {
			$('.list',pldiv).removeClass("hidden");
		}
	};

	/*
	
	
		when creating a playlist view
	
	
	*/
	var _createRPLDisplay = function (content_container, id ) {
		var pldiv = $( tpl.mustacheView('my.plm.rpl') )
			.hide()
		.attr('name',id);

		dnd.dropTarget (pldiv,$('.list',pldiv),{
			"moveDrop": function(source,target,infos) {
				if ( infos.wantedNode ) { infos.wantedNode.after(source); } 
				else { $('.list',pldiv).prepend(source); }
				that.update_playlist(pldiv.attr("name"), pldiv.find(".list > .song"));
				return true;
			},
			"copyDrop": function(source,target,infos) {
				debug("copyDrop, wantedNode : ",infos.wantedNode, infos);
				var item = source.clone().removeClass('hidden').removeClass('dragging').removeClass('selected').removeClass('current').show().css('display','').css('opacity',1);
				if ( infos.wantedNode ) { infos.wantedNode.after(item); } 
				else { $('.list',pldiv).prepend(item); }
				if ( $('.empty:visible',pldiv).length ) {
					$('.empty',pldiv).addClass("hidden");
				}
				if ( $('.list:visible',pldiv).length == 0 ) {
					$('.list',pldiv).removeClass("hidden");
				}
				
				that.update_playlist(pldiv.attr("name"), pldiv.find(".list > .song"));
	//			$(document).trigger('rplUpdateRequest', pldiv );
				
				return true;
			}
		});

		pldiv.find('.list')
		.delegate("div.song span.remove","click",function(e) {
			$(this).closest('.song').fadeOut('fast',function() {
				$(this).remove();
				if ( $('.song',pldiv).length == 0 ) {
				$('.empty',pldiv).toggleClass("hidden",false);
				$(".list",pldiv).toggleClass("hidden",true);
				}
				that.update_playlist(pldiv.attr("name"));
			});
		});
		pldiv.find('.controls button[name=rename]').click(function() {
			pldiv.find('.controls').hide();
			pldiv.find('.rename').slideDown();
			pldiv.find('.rename input[name=name]').val(
				$('.plm-list .plm-list-item[name='+pldiv.attr('name')+']',mydiv).text()
			).get(0).focus();
		});
		pldiv.find(".rename input[name=name]").keypress(function(e) {
			if ( e.keyCode == 13 ) {
				pldiv.find(".rename button[name=rename]").click();
			}
		});
		pldiv.find('.rename button[name=rename]').click(function () {
			rplRenameRequestHandler(pldiv,pldiv.find('.rename input[name=name]').val());
			pldiv.find('.controls').slideDown();
			pldiv.find('.rename').hide();
			return false;
		});
		pldiv.find('.rename button[name=no]').click(function () {
			pldiv.find('.controls').slideDown();
			pldiv.find('.rename').hide();
			return false;
		});

		pldiv.find('.controls button[name=drop]').click(function() {
			pldiv.find('.controls').hide();
			pldiv.find('.drop').slideDown();
			return false;
		});
		pldiv.find('.drop button[name=yes]').click(function () {
			rplDropRequestHandler(pldiv);
			pldiv.find('.controls').slideDown();
			pldiv.find('.drop').hide();
			return false;
		});
		pldiv.find('.drop button[name=no]').click(function () {
			pldiv.find('.controls').slideDown();
			pldiv.find('.drop').hide();
			return false;
		});
		pldiv.find('button[name=load]').click(function() {
			
			var rpldoc = {
				_id: pldiv.attr('name'),
				name: $('.plm-list .plm-list-item[name='+pldiv.attr('name')+']',mydiv).html(),
				songs: pldiv.children(".list").children(".song").map(function() {      return $(this).attr('name');    }   ).get()
			};

			playlist.empty();
			playlist.append(pldiv.children(".list").children(".song").clone());		
			playlist.loadDriver("rpl",{},{rpldoc: rpldoc},function(err,resp) {
				if ( err )	{
					debug("playlistModuleRpl:loadDriver error",err);
					return ;
				}
				debug("plm setting driver",this);
				playlist.setDriver(this);
			});
		return false;
		});
		content_container.append(pldiv);
		return pldiv;
	}

	// used in utils.js
	this.init_topic_plm = function () {
		//only load once
		if ( mypldiv.data('loaded') ) {
			return ;
		}
		
		mypldiv.data('loaded',true);
		mypldiv.append(tpl.mustacheView('my.plm'));
		
		// event binding
		$('section.plm-list-container .plm-new-form button[name=create]',mypldiv).click(function() {
			$('section.plm-list-container .plm-new-form',mypldiv).hide();
			$('section.plm-list-container',mypldiv).append($('#waititem > img').clone());
			// create new empty playlist
			that.create_playlist( $('section.plm-list-container .plm-new-form input[name=name]',mypldiv).val(), mypldiv );
			return false;
		});
		$('section.plm-list-container .plm-new-form button[name=cancel]',mypldiv).click(function() {
			$('section.plm-list-container img',mypldiv).remove();
			$('section.plm-list-container .plm-new-form',mypldiv).hide();
			$('section.plm-list-container button[name=plm-new]',mypldiv).slideDown('fast');
			return false;
		});
		// user playlists
		var playlists = user.get_playlists();
		for ( var index in  playlists ) {
			$('.plm-list',mypldiv).append(
				'<div class="plm-list-item" name="'+playlists[index]._id+'" action="'+playlists[index]._id+'">'+utils.encodeHTMLEntities(playlists[index].name)+'</div>'
			);
		}

		// bind new playlist link
		$('section.plm-list-container button[name=plm-new]',mypldiv).click (function() {
			$(this).hide().next('.plm-new-form')
			.slideDown('fast').find('input[type=text]').val('').focus();
			return false;
		});
		whenPlmInit();
	};

	this.plm_playlist_display = function (id) {
			debug("plm_playlist_display starting: ",id);
			var content_container = $('section.plm-content-container',mypldiv);
			//$('div.rpl',content_container).hide();
			var pldiv = $('div.rpl[name='+id+']',content_container);
			if ( !pldiv.length ) {
//				debug("plm_playlist_display: rpl "+id+" does not exist: creating");
				pldiv = _createRPLDisplay ( content_container , id );
				$('.pleaseWait',pldiv).show();
				$('.list',pldiv).removeClass('hidden').addClass('hidden');
				$('.empty',pldiv).addClass("hidden");
				$('.controls',pldiv).hide();
				
				var onPlaylistResponse = function ( err, response ) {
					if ( err ) {
						return ;
					}
					debug("plm load response",response);
					$('.list',pldiv).empty();

					var songs = '';
					for ( var index in response.songs ) {
						if ( response.songs[index] ) {
							songs+= tpl.song_template(response.songs[index]);
						}
					}
					_appendSong ($(songs), pldiv) ;
					if  ( $('.pleaseWait',pldiv).css('display') != 'none' ) {
						$('.pleaseWait',pldiv).hide();
						if ( $('.list',pldiv).children().length ) {
							$('.list',pldiv).removeClass("hidden");
					$('.empty',pldiv).addClass("hidden");
						} else {
							$('.empty',pldiv).removeClass("hidden");
						}
						$('.controls',pldiv).show();
					}
				};
				rest.rpl.get(id,{
					load: onPlaylistResponse
				});

			}
	}

	this.display = this.plm_playlist_display;

	/*
	
		Create a playlist
		
	*/

	this.create_playlist = function (name,opts) {
		opts = opts || {};
		if ( name.length == 0 || user.playlist_exists(name) ) {
			$('section.plm-list-container img',mypldiv).remove();
			$('section.plm-list-container button[name=plm-new]',mypldiv).slideDown('fast');
			return ;
		}
		
		rest.rpl.create(name, opts.songs ? opts.songs : [], {
			load: function(err,resp) {
				if(err) {
					debug('trigger; rplCreationFailure');
					pubsub.topic('rplCreationFailure').publish(err);
					if ( opts.error ) {
						opts.error(err);
					}
					$('section.plm-list-container img',topicdiv).remove();
					$('section.plm-list-container button[name=plm-new]',topicdiv).show();
				} else {
					var rplCreationSuccessHandler = function(response) {
						debug("plm:rplCreationSuccessHandler response: ",response);
						if ( !mypldiv.length )	return ;
					   // playlist menu item
						var pl_item = $('<div class="plm-list-item" name="'+response.playlist._id+'" action="'+response.playlist._id+'"></div>');
						debug("plm:createplaylist pl_item: ",pl_item);
						pl_item.html(utils.encodeHTMLEntities(response.playlist.name));
						debug("plm:createplaylist pl_item: ",pl_item);
						//
						// place menu item alphabetically
						//
						var set=false;
						$('section.plm-list-container .plm-list > div',mypldiv).each (function(i) {
							if ( $(this).html() > response.playlist.name ) {
								$(this).before(pl_item);
								set=true;
								return false;
							}
						});
						if ( set == false ) {
							$('section.plm-list-container .plm-list',mypldiv).append(pl_item);
						}
						
						//
						// remove creation form and show creation link
						//
						// 		if ( response.from && response.from == 'plm' ) {
						$('section.plm-list-container img',mypldiv).remove();
						$('section.plm-list-container  button[name=plm-new]',mypldiv).show();
						// 		}
						//
						// trigger the click event on newly added list item
						//
						debug("plm:createplaylist pl_item: ",pl_item);
                        if ( !opts.noDisplay ) {
                          pl_item.trigger('click');
                        }
					}
					debug(resp);
					rplCreationSuccessHandler(resp);
					if ( opts.success ) {
						opts.success(resp.playlist);
					}
					debug('trigger; rplCreationSuccess');
					pubsub.topic('rplCreationSuccess').publish({ 'playlist': resp.playlist});
				}
			}
		});
		pubsub.topic('rplCreationRequest').publish({ 'name': name , 'from':'plm' });
	}
  /*
   *
   * Update playlist list
   *
   */
  
  
	var _update_playlist = function(name, songs, opts) {
		opts = opts || {};
		rest.rpl.update(name,songs,{
			load: function(err,resp) {
				if ( err ) {
					if ( opts.error ) {
						opts.error(err);
					}
				} else {
					if ( opts.success ) { opts.success(resp); }
				}
			}
		});
	};
  

	this.update_playlist = function(name,opts) {
	
		var doUpdate = function() {
			var pldiv = mydiv.find(".rpl[name="+name+"]");
			if ( !pldiv.length ) {
				if ( opts.error ) {
					opts.error.call(name);
				}
				return;
			}
// 			debug("doUpdate, pldiv = ",pldiv," and songs = ",pldiv.find(".list>.song"));
			var songs_id = pldiv.find(".list>.song").map(function() { return $(this).attr('name');	}).get();
// 			debug("updating playlist",name,songs_id);
			_update_playlist(name, songs_id, {
				success: function(response) {
					if ( opts.success ) { opts.success(response); }
					pubsub.topic('rplUpdateSuccess').publish({ 'playlist': response.playlist  });
				},
				error: function(e) {
					if ( opts.error ) { opts.error(e); }
					debug('triggering rplUpdateFailure');
					pubsub.topic('rplUpdateFailure').publish(e);
				}
			}); 
		};		
		
		opts = opts||{};
		doUpdate();

	};

	this.replace_playlist = function(name,songs,opts) {
		opts = opts||{};
		_update_playlist(name, songs, {
			success: function(response) {
				debug("plm:replace_playlist success callback response: ",response);
				var pldiv = mypldiv.find("section.plm-content-container .rpl[name="+name+"] > .list");
				if ( pldiv.length ) {
					var html = tpl.song_template(response.data.songs);
					pldiv.empty();
					if ( html.length ) {
						pldiv.html(html);
					}
				}
				if ( opts.success ) { opts.success(response); }
				pubsub.topic('rplUpdateSuccess').publish({playlist: response.data.playlist  });
			},
			error: function(e) {
				if ( opts.error ) { opts.error(e); }
				debug('triggering rplUpdateFailure');
				pubsub.topic('rplUpdateFailure').publish(response.request);
			}
		}); 
	};

  var rplDropRequestHandler = function ( pldiv ) {
	rest.rpl.remove(pldiv.attr('name'), {
		load: function(err,resp) {
			if ( !err ) {
				pubsub.topic('rplDropSuccess').publish(resp);
			} else {
				pubsub.topic('rplDropFailure').publish(resp);
			}
		}
	});
  }

  var rplDropSuccessHandler = function ( playlist ) {
		debug("drop success : ",playlist);
		$('.plm-list .plm-list-item[name='+playlist._id+']',mydiv).slideUp(function() {$(this).remove();});
		$('.plm-content-container .rpl[name='+playlist._id+']',mydiv).fadeOut(function() {$(this).remove();});
  }


  /**
   *
   *
   *Playlist renaming
   *
   *
   */

	var rplRenameRequestHandler = function ( pldiv, newname ) {
		rest.rpl.rename(pldiv.attr('name'), newname, {
			load: function(err,resp) {
				if ( err ) {
					pubsub.topic('rplRenameFailure').publish(err);
				} else {
					pubsub.topic('rplRenameSuccess').publish(resp);
				}
			}
		});
	};


	var rplRenameSuccessHandler = function ( response ) {
		var item = $('.plm-list .plm-list-item[name='+response._id+']',mydiv);
		if ( item.length ) {
		item.html(utils.encodeHTMLEntities(response.name));
		}
	}
	

	this.append_song = function(song_id,playlist_id,opts) {
		opts = opts || {};
		rest.rpl.append(playlist_id,song_id,{
			load: function(err,resp) {
              debug(err,resp);
				if ( err ) {
					if ( opts.error ) {
						opts.error.call(e);
					}
					pubsub.topic('rplAppendFailure').publish(err);
				} else  {
					var playlistdiv=$('div[name=plm] .rpl[name='+resp.playlist._id+']',mydiv);
					if ( playlistdiv.length ) {
                      _appendSong (resp.song, playlistdiv, -1) ;
                    }
                    if ( opts.success ) {
                        opts.success.call(resp);
                    }
					debug('trigger; rplAppendSuccess');
					pubsub.topic('rplAppendSuccess').publish({ 'playlist': resp.playlist, 'song': resp.song, 'index': -1 });
				}
			}
		});
	};

};

	var ui = $("#my"), plm = new playlistManager(ui,ui.find('div[name=plm]'));
	var whenPlmInit = function() {
		var plmRouteHandler = function(id) {
			debug("plmRouteHandler");
			if ( id && this._containers["plm"].currentActive != id ) { plm.display(id); }
			this._activate("main","my",this.switchMainContainer)._activate("my","plm");
			if ( id && this._containers["plm"].currentActive != id ) { this._activate("plm",id); }
		};
		router._containers["plm"] = 
		{
			tab: $("#my .plm .plm-list-container .plm-list"),
			container: $("#my .plm-content-container"),
			select: function(name) {return this.container.children("div[name="+name+"]"); },
			lastActive: null,
			currentActive: null
		};
		router.route("my/plm", "plm", plmRouteHandler);
		router.route("my/plm/:id", "plm", plmRouteHandler);
		$("#my div[name=plm]").delegate(".plm-list-container .plm-list [action]","click",function() {
			var elem = $(this), action = elem.attr("action");
			if ( ! elem.hasClass("active") ) { router.navigateTo(["my","plm",action]); }
		});
	};
	return plm;
});
