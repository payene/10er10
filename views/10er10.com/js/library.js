(function(d10,$) {

if (! "fn" in d10 ) { d10.fn = {}; }
	
	d10.fn.library = function (ui) {

		ui.delegate("div.song",'dragstart', d10.dnd.onDragDefault)
			.delegate("div.song",'dragend',d10.dnd.removeDragItem)
			.delegate("div.song","dblclick",function(e) {
				d10.playlist.append($(this).clone());
			})
			.delegate("div.song","click",function(e) {
				var target = $(e.target);
				if ( target.closest(".add").length == 0 && target.closest(".artist").length == 0 && target.closest(".album").length == 0 )
					$(this).toggleClass("selected");
		});

		ui.delegate(".albumWidget .albumName","click",function() {
			d10.router.navigateTo(["library","albums",$(this).closest(".albumWidget").attr("data-name")]);
		}).delegate(".albumWidget img","click",function() {
			d10.router.navigateTo(["library","albums",$(this).closest(".albumWidget").attr("data-name")]);
		})
		.delegate(".albumWidget .oneArtist","click",function() {
			d10.router.navigateTo(["library","artists",$(this).attr("data-name")]);
		})
		.delegate(".albumWidget .oneGenre","click",function() {
			d10.router.navigateTo(["library","genres",$(this).attr("data-name")]);
		})
		.delegate(".albumWidget .showSongs","click",function() {
			var widget = $(this).closest(".albumWidget");
			widget.find(".showSongs").hide();
			widget.find(".hideSongs").show();
			widget.find(".list").css("display","table");
		})
		.delegate(".albumWidget .hideSongs","click",function() {
			var widget = $(this).closest(".albumWidget");
			widget.find(".hideSongs").hide();
			widget.find(".showSongs").show();
			widget.find(".list").hide();
		})
		;
			
		d10.events.bind("whenLibraryScopeChange", function() {
			var hitsTab = ui.children("nav").find("li[action=hits]");
			if ( hitsTab.hasClass("active") ) {
				d10.router.navigateTo(["library","genres"]);
			}
			if ( d10.libraryScope.current == "full" ) {
				hitsTab.fadeIn();
			} else {
				hitsTab.fadeOut();
			}
		});
		
		ui.children("nav").find(".libraryMenuButton").click(function() {
			var button = $(this), offset = button.offset(), height = button.height();
// 			debug(button.offset());
			var label = ( d10.libraryScope.current == "full" ) ? d10.mustacheView("library.scope.toggle.user",{}) : d10.mustacheView("library.scope.toggle.full",{}) ;
			var widget = $(
				d10.mustacheView("hoverbox.library.scope", {toggle_scope: label})
				).hide();
			$("body").append(widget);
			offset.left = offset.left - widget.width();
			offset.top += height;
			widget.offset(offset);
			widget.find(".toggleScope").click(function() {
				widget.ovlay().close();
				d10.libraryScope.toggle();
			});
			widget.ovlay({"onClose": function() {this.getOverlay().remove()}, "closeOnMouseOut": true });
		});
		
			
		var init_topic = function (topic,category) {
			debug("library.display start",topic,category);
			if ( typeof category == "undefined" ) {
				category = "";
			}
			//
			// create topic div + controls (if any)
			//
			var topicdiv = $('div[name='+topic+']',ui);
			if ( topicdiv.length == 0 ) {
				topicdiv=$('<div name="'+topic+'"></div>');
				init_controls(topic,topicdiv);
				ui.append(topicdiv);
			}
			
			if ( topic == "genres" && !category ) { category = "<all>"; }

			//
			//if category is specified select it
			//
			if ( category ) {
				selectTopicCategory(topic,category,topicdiv);
			} else {
				category = getSelectedTopicCategory (topic, topicdiv );
			}

			//
			// launch the topic category display
			//

			//
			// get id
			//
			var id = get_id(topic,topicdiv,category);
			debug("ID: ",id);
			//
			// get topic category container
			//
			var categorydiv=$('div[name="'+id+'"]',topicdiv);
			if ( !categorydiv.length ) {
				if ( topic == "genres" && category == "<all>" ) {
					categorydiv=$('<div name="'+id+'" class="topic_category">'+d10.mustacheView("loading")+d10.mustacheView("library.control.genre")+"</div>");
				} else if ( topic == "genres" ) {
					categorydiv=$('<div name="'+id+'" class="topic_category">'+d10.mustacheView("loading")+d10.mustacheView("library.content.genre")+"</div>");
					categorydiv.find("article h2 > span:first-child").text(category);
					categorydiv.find("article h2 > .link").click(function() { d10.router.navigateTo(["library","genres"]); });
					bindControls(categorydiv, topic, category);
				} else {
					categorydiv=$('<div name="'+id+'" class="topic_category">'+d10.mustacheView("loading")+d10.mustacheView("library.content.simple")+"</div>");
					bindControls(categorydiv, topic, category);
					if ( topic == "albums" && !category ) {
						categorydiv.find(".selectVisible").hide();
						categorydiv.find(".pushAll").hide();
					}
				}
				topicdiv.append(categorydiv);
			} else {
				debug("already got category div", id, topicdiv.data('activeCategory'));
			}
			
			// special pages
			if ( topic == "artists" && category == "<all>" ) {
				debug("special category case");
				allArtists(categorydiv);
			} else if ( topic == "genres" && category == "<all>" ) {
				displayGenres(categorydiv);
			} else {
				// create the infiniteScroll
				var section = categorydiv.find("section");
				if ( !section.data("infiniteScroll") ) {
					createInfiniteScroll(categorydiv, topic, category);
				}
			}
			//
			// show current topic category if not already visible
			//
			if ( topicdiv.data('activeCategory') != id ) {
				$('div.topic_category',topicdiv).hide();
				categorydiv.show();
				topicdiv.data('activeCategory',id);
			}

		} 

		var getCurrentCategory = function(topic) {
			var topicdiv = ui.children('div[name='+topic+']');
			if ( topicdiv.length == 0 ) {
				return false;
			}
			var back = false;
			topicdiv.find(".topic_category").each(function() {
				if ( $(this).css("display") == "block" ) {
					back = get_category_from_id(topic, $(this).attr("name"));
					return false;
				}
			});
			return back;
		};

		var resetCache = function() {
			d10.localcache.unset("genres.index");
			d10.localcache.unset("artists.allartists");
		};
		
		var albumResultsParser = function(rows) { //[ [ {key:.., doc: song}, ...], ... ]
			var html=null ;
			rows.forEach(function(songs) {
				var artists = {}, genres = {}, images = {}, image = null, duration = 0, songsHtml = "", tpl = {duration: 0, songsNb: songs.length, artists: [], genres: [], image_class: []};
				songs.forEach(function(row) {
						tpl.album = row.doc.album;
						artists[row.doc.artist] = 1;
						if ( row.doc.genre ) {
							genres[row.doc.genre] = 1;
						}
						duration+=row.doc.duration;
						if ( row.doc.images ) {
							row.doc.images.forEach(function(i) {
								if ( images[i.filename] ) {
									images[i.filename]++;
								} else {
									images[i.filename]=1;
								}
							});
						}
						songsHtml+=d10.song_template(row.doc);

				});
				for ( var k in artists ) { tpl.artists.push(k); }
				for ( var k in genres ) { tpl.genres.push(k); }
				var d = new Date(1970,1,1,0,0,duration);
				tpl.duration = d.getMinutes()+':'+d.getSeconds();
				image = d10.keyOfHighestValue(images);
				if ( image ) { 
					image = d10.config.img_root+"/"+image ;
				} else {
					image = d10.getAlbumDefaultImage();
					tpl.image_class.push("dropbox");
				}
				tpl.image_url = image;
				tpl.songs = songsHtml;
				if ( !html ) {
					html=$(d10.mustacheView("library.content.album.widget",tpl));
				} else {
					html = html.add($(d10.mustacheView("library.content.album.widget",tpl)));
				}
			});
			if ( !html ) {
				debug("no html for ",rows.length, rows);
				html = "";
			}
			return html;
		};
		
		
		var albumImageUpload = function (image, file) {
			debug("Start of setting album image",image,file);
			var ids = image.closest(".albumWidget").find(".list .song").map(function(k,v) {
// 				console.dir(this);
				return $(this).attr("name");
			}).get();
			debug("album ids: ",ids);
			
			d10.rest.song.uploadImage(ids, file, file.name, file.size, {
				load: function(err, headers, body) {
					if ( err || !body || !body.filename ) {
						debug("image upload failed",err, body);
						d10.osd.send("error",d10.mustacheView("my.review.error.filetransfert"));
// 						canvas.remove();
// 						cb(false);
						return ;
					}
					d10.osd.send("info",d10.mustacheView("my.review.success.filetransfert",{filename: file.name}));
// 					canvas.remove();
// 					dropbox.find(".images").append(
// 							d10.mustacheView("my.image.widget",{url: d10.config.img_root+"/"+body.filename})
// 					);
// 					cb();
				},
				progress: function(e) { 
					if (e.lengthComputable) {
						var percentage = Math.round((e.loaded * 100) / e.total);
// 						api.loadProgress(percentage);
					}  
				},
				end: function(e) {  
// 					api.loadProgress(100);
				}
			});
		};
		
		var displayGenresListener = false;
		var displayGenres = function(categorydiv) {
			var cacheNotExpired = d10.localcache.getJSON("genres.index");
			if ( cacheNotExpired ) { 
			}
			var restEndPoint = d10.libraryScope.current == "full" ? d10.rest.genre.resume : d10.rest.user.genre.resume;
			restEndPoint({
				load: function(err, data) {
					if ( err ) {
						return ;
					}
					d10.localcache.setJSON("genres.index", {"f":"b"},true);
					var content = "";
					$.each(data,function(k,v) { //{"key":["Dub"],"value":{"count":50,"artists":["Velvet Shadows","Tommy McCook & The Aggrovators","Thomsons All Stars"]}}
						var artists = "";
						$.each(v.value.artists,function(foo,artist) {
							artists+=d10.mustacheView("library.listing.genre.line", {"artist": artist})
						});
						content+=d10.mustacheView("library.listing.genre", {"genre": v.key[0],"count": v.value.count},  {"artists": artists});
					});
					categorydiv.find("div.genresLanding").html(content);
					categorydiv.find("div.pleaseWait").hide();
					categorydiv.find("div.genresLanding")
					.show()
					.delegate("span.artistName","click",function() {
						d10.router.navigateTo(["library","artists",$(this).text()]);
					})
					.delegate("div.genre > span","click",function() {
						d10.router.navigateTo(["library","genres",$(this).text()]);
					})
					.delegate("span.all","click",function() {
						var genre = $(this).closest("div.genre").children("span").text();
						d10.router.navigateTo(["library","genres",genre]);
					});
				}
			});
			if ( !displayGenresListener ) {
				displayGenresListener = true;
				d10.events.bind("whenLibraryScopeChange", function() {
					resetCache();
					displayGenres(categorydiv);
				});
			}
		};

		var selectVisible = function(categorydiv) {
			var list = categorydiv.find(".list"),
				parent = list.parent(),
				songs = list.children(),
				coutHeight = parent.outerHeight(),
				ctop = parent.position().top;

			songs.removeClass("selected");
			for ( var i = 0, last = songs.length; i<last; i++ ) {
				var song = songs.eq(i),
				postop = song.position().top -ctop,
				outheight = song.outerHeight(),
				delta = outheight * 0.1;
				if ( postop >= -delta ) {
					if (  (postop + outheight - delta) < coutHeight ) {
					song.addClass("selected");
					} else {
						break;
					}
				}
			}
		};
		
		var bindControls = function(categorydiv, topic, category) {
			categorydiv.find(".pushAll").click(function() {
				d10.playlist.append(categorydiv.find(".song").clone().removeClass("selected"));
			});
			categorydiv.find(".selectVisible").click(function() {
				selectVisible(categorydiv);
			});
			
			var refresh = function() {
// 				categorydiv.find(".song").remove();
				categorydiv.find(".list").empty();
				categorydiv.find(".extendedInfos").empty();
				var is = categorydiv.find("section").data("infiniteScroll");
				if ( is && "remove" in is ) {
					is.remove();
				}
				createInfiniteScroll(categorydiv, topic, category);
			};
			
			categorydiv.find(".refresh").click(function() {
				refresh();
			});
			d10.events.bind("whenLibraryScopeChange",function() {
				refresh();
			});
		};
		
		var createInfiniteScroll = function(categorydiv, topic, category) {
			var section = categorydiv.find("section");
			var restBase = (topic == "hits" || d10.libraryScope.current == "full") ? d10.rest.song.list : d10.rest.user.song.list;
			var data = {}, endpoint = restBase[topic];
			if ( topic == "genres" ) {
				data.genre = category;
			} else if ( topic == "albums" ) {
				data.album = category ? category : "";
			} else if ( topic == "artists" ) {
				data.artist = category ? category : "";
			} else if ( topic == "titles" ) {
				data.title = category ? category : "";
			} else if ( topic != "creations" && topic != "hits" ) {
				return false;
			}
			var loadTimeout = null, 
				innerLoading = categorydiv.find(".innerLoading"), cursor;
			
			var isOpts = 
			{
				onFirstContent: function(length) {
					categorydiv.find(".pleaseWait").remove();
					categorydiv.find(".songlist").removeClass("hidden");
					if ( !length ) {
						categorydiv.find("article").hide();
						categorydiv.find(".noResult").removeClass("hidden");
						return ;
					}
					
					var list = categorydiv.find(".list");
					section.next(".grippie").show();
					section.makeResizable(
						{
							vertical: true,
							minHeight: 100,
							maxHeight: function() {
								// always the scrollHeight
								var sh = list.prop("scrollHeight");
								if ( sh ) {
									return sh -10;
								}
								return 0;
							},
							grippie: $(categorydiv).find(".grippie")
						}
					);
					
					if ( d10.fn.library.extendedInfos[topic] ) {
						d10.fn.library.extendedInfos[topic](category,categorydiv);
					}
					
				},
				onQuery: function() {
					loadTimeout = setTimeout(function() {
						loadTimeout = null;
						debug("Loading...");
						innerLoading.css("top", section.height() - 32).removeClass("hidden");
					},500);
				},
				onContent: function() {
					if ( loadTimeout ) {
						clearTimeout(loadTimeout);
					} else {
						innerLoading.addClass("hidden");
					}
				}
			};

			if ( topic == "albums" && !category ) {
				cursor = new d10.fn.couchMapMergedCursor(restBase.albums,{},"album");
				isOpts.parseResults = albumResultsParser;
			} else {
				cursor = new d10.fn.couchMapCursor(endpoint, data);
			}

			section.data("infiniteScroll",
				section.d10scroll(cursor,section.find(".list"),isOpts)
			);
		};
		
		
		
		var allArtistsListener = false;
		var allArtists = function (container) {
			var cacheNotExpired = d10.localcache.getJSON("artists.allartists");
			var restEndPoint = d10.libraryScope.current == "full" ? d10.rest.artist.allByName : d10.rest.user.artist.allByName;
			if ( cacheNotExpired ) { return ; }
			d10.localcache.setJSON("artists.allartists", {"f":"b"},true);
			container.empty();
			
			restEndPoint({
				"load": function(err, data) {
					if ( !err ) {
						displayAllArtists(container,data);
					}
				}
			});
			
			if ( !allArtistsListener ) {
				allArtistsListener = true;
				d10.events.bind("whenLibraryScopeChange",function() {
					resetCache();
					allArtists(container);
				});
			}
			
		};

		var displayAllArtists = function (container, data) {
			debug("displayAllArtists",container,data);
// 			data = data.data;
			var letter = '';
			var letter_container = null;
			for ( var index in data ) {
				var artist = data[index].key.pop();
				var songs = data[index].value;
				var current_letter = artist.substring(0,1);
				if ( current_letter != letter ) {
					if ( letter_container ) container.append(letter_container);
					letter = current_letter;
					letter_container = $( d10.mustacheView("library.listing.artist", {"letter": letter}) );
				}
				$(">div",letter_container).append( d10.mustacheView("library.listing.artist.line", {"artist": artist, "songs": songs}) );
			}
			if ( letter_container ) { container.append( letter_container ); }

			$("span.link",container).click(function() {
				d10.router.navigateTo(["library","artists",$(this).text()]);
			});
		};

		var init_controls = function (topic,catdiv) {
			if ( topic == 'artists' ) {
				catdiv.append( d10.mustacheView('library.control.artist') );
				var widget = $("input[name=artist]",catdiv);
				$("span[name=all]",catdiv).click(function(){ widget.val('').trigger('blur');  d10.router.navigateTo(["library","artists","<all>"]); });
				$('img[name=clear]',catdiv).click(function() { widget.val('').trigger('blur'); d10.router.navigateTo(["library",topic]); });
				var overlay = widget.val(widget.attr('defaultvalue'))
				.permanentOvlay( d10.libraryScope.current == "full" ? d10.rest.artist.list : d10.rest.user.artist.list , $(".overlay",catdiv),{
					"autocss": true,
					"minlength" : 1 ,
					"select": function (data, json) {
						d10.router.navigateTo(["library",topic,json]);
						return json;
					},
					"beforeLoad": function() {
						this.getOverlay().width(widget.width());
					},
				});
				d10.events.bind("whenLibraryScopeChange",function() {
					if ( d10.libraryScope.current == "full" ) {
						overlay.setUrl(d10.rest.artist.list);
					} else {
						overlay.setUrl(d10.rest.user.artist.list);
					}
				});
			} else if ( topic == 'albums' ) {
				catdiv.append( d10.mustacheView('library.control.album') );
				var widget = $('input[name=album]',catdiv);
				var overlay = widget.val(widget.attr('defaultvalue'))
				.permanentOvlay(d10.libraryScope.current == "full" ? d10.rest.album.list : d10.rest.user.album.list, $(".overlay",catdiv),
						{
							"varname": "start", 
							"minlength" : 1 ,
							"autocss": true,
							"select": function (data, json) {
								d10.router.navigateTo(["library",topic,data]);
								return data;
							}
						}
				);
				d10.events.bind("whenLibraryScopeChange",function() {
					if ( d10.libraryScope.current == "full" ) {
						overlay.setUrl(d10.rest.album.list);
					} else {
						overlay.setUrl(d10.rest.user.album.list);
					}
				});
				$('img[name=clear]',catdiv).click(function() { widget.val('').trigger("blur"); d10.router.navigateTo(["library",topic]); });
				
				
				catdiv.delegate(".dropbox", "dragenter",function (e) {
					$(this).addClass("hover");
					e.stopPropagation();
					e.preventDefault();
				})
				.delegate(".dropbox","dragover",function (e) {
					e.stopPropagation();
					e.preventDefault();
				})
				.delegate(".dropbox","dragleave",function (e) {
					$(this).removeClass("hover");
				})
				.delegate(".dropbox","drop",function (e) {
					e.stopPropagation();
					e.preventDefault();
					var that=$(this);
					that.removeClass("hover");
					var files = e.originalEvent.dataTransfer.files;
					debug("files",files);
					if ( !files.length  ) { return ; }
					var file = files[0];
					if ( !d10.isImage(file) ) { return ; }
					albumImageUpload(that, file);
				});
				
			} else if ( topic == 'titles' ) {
				catdiv.append( d10.mustacheView('library.control.title') );
				var widget = $('input[name=title]',catdiv);
				var overlay = widget.val(widget.attr('defaultvalue'))
				.permanentOvlay( d10.libraryScope.current == "full" ? d10.rest.song.listByTitle : d10.rest.user.song.listByTitle, $(".overlay",catdiv), 
					{
						"autocss": true,
						"varname": 'start', 
						"minlength" : 1 ,
						"select": function (data, json) {
							d10.router.navigateTo(["library",topic,data]);
							return data;
						}
					}
				);
				d10.events.bind("whenLibraryScopeChange",function() {
					if ( d10.libraryScope.current == "full" ) {
						overlay.setUrl(d10.rest.song.listByTitle);
					} else {
						overlay.setUrl(d10.rest.user.song.listByTitle);
					}
				});
				$('img[name=clear]',catdiv).click(function() { widget.val('').trigger("blur"); d10.router.navigateTo(["library",topic]); });
			}
			return catdiv;
		}

		var get_id = function (topic,catdiv,category) {
			var id=topic;
			category = category || '';
			if ( topic == 'genres' || topic == 'artists' || topic == 'albums' || topic == 'titles' ) {
				id='_'+ escape(category) ;
			}
			return id;
		}

		var get_category_from_id = function(topic, id)  {
			if ( topic == 'genres' || topic == 'artists' || topic == 'albums' || topic == 'titles' ) {
				id =  unescape( id.substr(1) ) 
				return id;
			} else {
				return false;
			}
		};

		var selectTopicCategory = function (topic,category,topicdiv) {
			if ( topic == 'artists' && category != '<all>' ) {
				$('input[name=artist]',topicdiv).val(category);
			} else if ( topic == 'albums' ) {
				$('input[name=album]',topicdiv).val(category);
			} else if ( topic == 'titles' ) {
				$('input[name=title]',topicdiv).val(category);
			}
			return topicdiv;
		}

		var getSelectedTopicCategory = function (topic, topicdiv ) {
			if ( topic == 'artists' ) {
				var widget = $('input[name=artist]',topicdiv);
				if ( widget.val() == widget.attr("defaultvalue") ) { return ""; }
				return widget.val();
			} else if ( topic == 'albums' ) {
				var widget = $('input[name=album]',topicdiv);
				if ( widget.val() == widget.attr("defaultvalue") ) { return ""; }
				return widget.val();
			} else if ( topic == 'titles' ) {
				var widget = $('input[name=title]',topicdiv);
				if ( widget.val() == widget.attr("defaultvalue") ) { return ""; }
				return widget.val();
			}
			return null;
		}

		return {
			display: init_topic,
			getCurrentCategory: getCurrentCategory
		};
	};














	var parseExtended = function (responses, infos, loading, showHide) {
		var infosParts = 0, infosTemplateData = {};
		for ( var i in responses ) {
			if ( responses[i].data.length ) {
				infosParts++;
				infosTemplateData["part"+infosParts+"title"] = responses[i].title;
			}
		}
		if ( infosParts == 0 ) {
			loading.hide();
			showHide.hide();
			infos.hide();
			return ;
		}
		var template = $(d10.mustacheView("library.content.extended."+infosParts+"part", infosTemplateData)).hide();

		infosParts = 0;
		for ( var i in responses ) {
			if ( responses[i].data.length ) {
				var ul = template.find(".part").eq(infosParts).find("ul");
				$.each(responses[i].data,function(i,v) { ul.append(v); });
				infosParts++;
			}
		}
		template.delegate("li","click",function() {
			d10.router.navigateTo($(this).attr("data-name"));
		});

		infos.append(template);
		if ( loading.length ) {
			if ( loading.is(":visible") ) {
				loading.slideUp("fast",function() {loading.remove();});
			} else {
				loading.remove();
			}
		}
		template.slideDown("fast");
	};
	
	
	d10.fn.library.extendedInfos = {
		genres: function(genre, topicdiv) {
			var hide = topicdiv.find("span.hide");
			var show = topicdiv.find("span.show");
			var loading = topicdiv.find(".extendedInfos .loading");
			var infos = topicdiv.find(".extendedInfos");
			if ( d10.user.get_preferences().hiddenExtendedInfos ) {
				hide.hide();
				show.show();
				infos.hide();
				topicdiv.find(".extendedInfosContainer").show();
			} else {
				hide.show();
				show.hide();
				topicdiv.find(".extendedInfosContainer").slideDown("fast");
			}

			d10.when({
				artists: function(then) {
					d10.rest.genre.artists(genre, {
						load: function(err, data) {
							if ( err )	return then(err);
							var back = {title:d10.mustacheView("library.extendedInfos.genre.artists"), data: []};
							for ( var i in data ) {
								back.data.push($("<li />").html(data[i].key[1])
													.attr("data-name","library/artists/"+encodeURIComponent( data[i].key[1])));
							}
							then(null,back);
						}
					});
				},
				albums: function(then) {
					d10.rest.genre.albums(genre, {
						load: function(err, data) {
							if ( err ) { return then(err); }
							var back = {title: d10.mustacheView("library.extendedInfos.genre.albums"), data: []};
							for ( var i in data ) {
								back.data.push($("<li />").html(data[i].key[1]+" ("+data[i].value+" songs)")
													.attr("data-name","library/albums/"+encodeURIComponent(data[i].key[1])));
							}
							then(null,back);
						},
					});
				}
			},
			function(errs,responses) {
				parseExtended(responses, infos, loading, topicdiv.find(".showHideExtended") );
			});
			hide.click(function() {
				infos.slideUp("fast");
				hide.slideUp("fast",function() {
					show.slideDown("fast");
				});
				d10.user.set_preference("hiddenExtendedInfos",true);
			});
			show.click(function() {
				infos.slideDown("fast");
				show.slideUp("fast",function() {
					hide.slideDown("fast");
				});
				d10.user.set_preference("hiddenExtendedInfos",false);
			});
		},
		artists: function(artist,topicdiv) {
			if ( !artist || !artist.length ) {
				topicdiv.find(".showHideExtended").remove();
				topicdiv.find(".extendedInfosContainer").remove();
				return ;
			}
			var show = topicdiv.find(".show");
			var hide = topicdiv.find(".hide");
			var loading = topicdiv.find(".extendedInfos .loading");
			var infos = topicdiv.find(".extendedInfos");
			if ( d10.user.get_preferences().hiddenExtendedInfos ) {
				hide.hide();
				show.show();
				infos.hide();
				topicdiv.find(".extendedInfosContainer").show();
			} else {
				hide.show();
				show.hide();
				topicdiv.find(".extendedInfosContainer").slideDown("fast");
			}
			topicdiv.find(".showHideExtended").removeClass("hidden");

			
			d10.when({
				artists: function(then) {
					d10.rest.artist.related(artist,{
						load: function(err, data) {
							if ( err ) { return then(err); }
							var back = [], sorted = [], source;
							if ( d10.count(data.artistsRelated) ) {
								source = data.artistsRelated;
							} else {
								source = data.artists;
							}
							for ( var i in source ) {
								var currentArtist = { artist: i, weight: source[i] },
									added = false;
								
								for (var j in sorted ) {
									if ( sorted[j].weight < currentArtist.weight ) {
										sorted.splice(j,0,currentArtist);
										added = true;
										break;
									}
								}
								if ( !added ) { sorted.push(currentArtist); }
							}
// 							debug(sorted);
							for ( var  i in sorted ) {
								back.push( $("<li />").html(sorted[i].artist)
									.attr("data-name","library/artists/"+ encodeURIComponent(sorted[i].artist)) );
							}

							then(null,{title: d10.mustacheView("library.extendedInfos.artist.artists"), data: back});
						}
					});
				},
				albums: function(then) {
					d10.rest.artist.albums(artist,{
						load: function(err, data) {
							if ( err ) { return then(err);}
							var back = [];
							for ( var i in data ) {
								back.push( $("<li />").html(data[i].key[1])
													.attr("data-name","library/albums/"+ encodeURIComponent(data[i].key[1])) );
							}
							then(null,{title: d10.mustacheView("library.extendedInfos.artist.albums"), data: back});
						},
						error: function(err) {
							then(err);
						}
					});
				},
				genres: function(then) {
					d10.rest.artist.genres(artist,{
						load: function(err,data) {
							if (err) { return then(err); }
							var back = [];
							for ( var i in data ) {
								back.push( $("<li />").html(data[i].key[1])
													.attr("data-name","library/genres/"+ encodeURIComponent(data[i].key[1])) );
							}
							then(null,{title: d10.mustacheView("library.extendedInfos.artist.genres"), data: back});
						}
					});
				}
			},
			function(errs,responses) {
				parseExtended(responses, infos, loading, topicdiv.find(".showHideExtended") );
			});
			hide.click(function() {
				infos.slideUp("fast");
				hide.slideUp("fast",function() {
					show.slideDown("fast");
				});
				d10.user.set_preference("hiddenExtendedInfos",true);
			});
			show.click(function() {
				infos.slideDown("fast");
				show.slideUp("fast",function() {
					hide.slideDown("fast");
				});
				d10.user.set_preference("hiddenExtendedInfos",false);
			});
		},
		albums: function(album,topicdiv) {
			if ( !album || !album.length ) {
				topicdiv.find(".showHideExtended").remove();
				topicdiv.find(".extendedInfosContainer").remove();
				return ;
			}
			var show = topicdiv.find(".show");
			var hide = topicdiv.find(".hide");
			var loading = topicdiv.find(".extendedInfos .loading");
			var infos = topicdiv.find(".extendedInfos");
			if ( d10.user.get_preferences().hiddenExtendedInfos ) {
				hide.hide();
				show.show();
				infos.hide();
				topicdiv.find(".extendedInfosContainer").show();
			} else {
				hide.show();
				show.hide();
				topicdiv.find(".extendedInfosContainer").slideDown("fast");
			}
			topicdiv.find(".showHideExtended").removeClass("hidden");
			
			d10.when({
				artists: function(then) {
					d10.rest.album.artists(album,{
						load: function(err, data) {
							if ( err ) { return then(err); }
							var back = [];
							for ( var i in data ) {
								back.push( $("<li />").html(data[i].key[1])
													.attr("data-name","library/artists/"+ encodeURIComponent(data[i].key[1])) );
							}
							if ( back.length == 1 ) {
								back = [];
							}
							then(null,{title: d10.mustacheView("library.extendedInfos.album.artists"), data: back});
						}
					});
				}
			},
			function(errs,responses) {
				parseExtended(responses, infos, loading, topicdiv.find(".showHideExtended") );
			});
			hide.click(function() {
				infos.slideUp("fast");
				hide.slideUp("fast",function() {
					show.slideDown("fast");
				});
				d10.user.set_preference("hiddenExtendedInfos",true);
			});
			show.click(function() {
				infos.slideDown("fast");
				show.slideUp("fast",function() {
					hide.slideDown("fast");
				});
				d10.user.set_preference("hiddenExtendedInfos",false);
			});
		}
	};










})( window.d10 ? window.d10 : {}  , jQuery) ;

$(document).one("bootstrap:router",function() {
// 	debug("bootstrapping router");
	var library = d10.library = d10.fn.library($('#library')),
	libraryRouteHandler = function(topic,category) {
		if ( !topic ) {
			if ( this._containers["library"].currentActive ) {
				this._activate("main","library",this.switchMainContainer);
				return ;
			} else {
				topic = "genres";
			}
		}
		library.display( decodeURIComponent(topic), category ? decodeURIComponent(category) : null );
		this._activate("main","library",this.switchMainContainer)._activate("library",topic);
	};
	d10.router._containers["library"] = 
	{
		tab: $("#library > nav > ul"), 
		container: $("#library"), 
		select: function(name) {return this.container.children("div[name="+name+"]"); }, 
		lastActive: null, 
		currentActive: null
	};
	
	d10.router.route("library","library",libraryRouteHandler);
	d10.router.route("library/:topic","library",libraryRouteHandler);
	d10.router.route("library/:topic/:category","library",libraryRouteHandler);
// 	d10.router.route("library/albumsList","library", libraryAlbumListHandler);
	
	d10.router._containers.library.tab.delegate("[action]","click",function() {
		var elem = $(this), action = elem.attr("action"), currentCategory = library.getCurrentCategory(action);
		
		if ( ! elem.hasClass("active") ) { 
			if ( currentCategory ) {d10.router.navigateTo(["library",action,currentCategory]); } 
			else { d10.router.navigateTo(["library",action]); }
		}
	});

	
});
