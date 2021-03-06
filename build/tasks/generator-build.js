/* global bs, config, fs, path, project */
/* jshint maxdepth: 4 */

module.exports = function(grunt) {
	var yaml = require('js-yaml'),
		Remarkable = require('remarkable');

	grunt.registerTask('buildGenerator', function(task) {
		var scope = this,
			build = Wee.$toArray(project.generator.build),
			configPath = '../../' + build[task],
			json = fs.readJsonSync(configPath),
			siteConfig = json.config,
			staticRoot = path.dirname(configPath),
			site = Wee.$extend(json.data, {
				config: config,
				description: json.description,
				env: 'default',
				name: json.name,
				sections: json.sections,
				time: new Date()
			}),
			errors = 0;

		// Setup CommonMark parser
		var md = new Remarkable({
			html: true,
			typographer: siteConfig.enhanceTypography || false
		});

		// Merge default environment data
		if (json.env['default']) {
			site = Wee.$extend(site, json.env['default']);
		}

		if (grunt.option('env')) {
			var env = grunt.option('env');

			site = Wee.$extend(site, json.env[env]);
			site.env = env;
		}

		var generatePaths = function(data, target) {
			var uri = target.replace(config.paths.root, ''),
				loc = path.parse(uri),
				ext = loc.ext,
				name = loc.name + ext;

			if (loc.name == 'index' && siteConfig.removeIndex) {
				name = '/';
			} else if (siteConfig.removeExtensions) {
				var extConfig = siteConfig.removeExtensions;

				if (Array.isArray(extConfig)) {
					if (extConfig.indexOf(ext.substr(1)) > -1) {
						name = loc.name;
					}
				} else if (extConfig === true) {
					name = loc.name;
				}
			}

			uri = path.join(loc.dir, name);

			if (siteConfig.removeTrailingSlashes === true) {
				uri = uri.replace(/\/$/, '');
			}

			data.path = uri;
			data.url = path.join(site.domain || '', uri);

			return data;
		};

		// Recursive function for processing site sections
		var processSection = function(context, parent) {
			var keys = Object.keys(context);

			// Loop though sections in current context
			keys.forEach(function(key) {
				var block = context[key],
					root = path.join(
						siteConfig.paths.content || '',
						block.contentRoot || ''
					),
					content = block.content ?
						grunt.file.expand({
							cwd: path.join(staticRoot, root)
						}, block.content) :
						[],
					data = {
						content: [],
						site: site
					},
					single = false,
					template = block.template || siteConfig.defaultTemplate;

				if (template.indexOf('.') === -1) {
					template += '.html';
				}

				template = fs.readFileSync(
					Wee.buildPath(
						staticRoot,
						siteConfig.paths.templates + '/' + template
					), 'utf8'
				);

				Wee.$toArray(block.target).forEach(function(target) {
					target = path.join(staticRoot, siteConfig.paths.target || '', target);

					// Target writing function
					var writeTarget = function(target, data) {
						// Add parent reference
						if (parent) {
							data.parent = parent;
						}

						// Create target directory
						var dir = target.substring(0, target.lastIndexOf('/'));

						fs.ensureDirSync(dir, function(err) {
							if (err) {
								Wee.notify({
									title: 'Generator Error',
									message: 'Error creating "' + dir + '" directory'
								}, 'error');
							}
						});

						// Render template
						var output = Wee.view.render(template, data);

						// Minify rendered output
						if (
							siteConfig.minify === true &&
							target.split('.').pop() === 'html'
						) {
							try {
								var minify = require('html-minifier').minify;

								output = minify(output, {
									collapseWhitespace: true,
									removeComments: true
								});
							} catch (e) {
								Wee.notify({
									title: 'Generator Error',
									message: 'Error minifying "' + target + '"'
								}, 'error');
							}
						}

						var done;

						if (grunt.cli.tasks[0] === 'generate') {
							done = scope.async();
						}

						// Write output to target file
						fs.outputFileSync(target, output, {}, function(err) {
							if (err) {
								Wee.notify({
									title: 'Generator Error',
									message: 'Error writing to "' + target + '"'
								}, 'error');

								errors++;
							}

							if (grunt.cli.tasks[0] === 'generate') {
								done();
							}
						});

						// Check for nested sections
						if (block.sections) {
							block.isCurrent = false;
							data.sections = block.sections;

							processSection(block.sections, block);
						}

						block.isActive = false;
						block.isCurrent = false;
					};

					// Merge in global config values
					if (block.data) {
						Wee.$extend(data, block.data);
					}

					// Determine target processing mode
					if (target.indexOf('{{') !== -1) {
						single = true;
					}

					// Set current section to active
					block.isActive = true;
					block.isCurrent = true;

					// Inject current context
					data.section = block;
					data.sections = block.sections;
					data.content = [];

					content.forEach(function(name) {
						var src = path.isAbsolute(name) ?
								name :
								Wee.buildPath(staticRoot, root + '/' + name),
							template = fs.readFileSync(src, 'utf8'),
							fileSegments = name.replace(/^.*[\\\/]/, '').split('.');

						fileSegments.splice(-1, 1);

						// Reset single data
						if (single === true) {
							data = {
								content: [],
								site: site,
								section: block,
								sections: block.sections
							};
						}

						var fileStats = fs.statSync(src),
							obj = {
								sourcePath: name,
								sourceFile: name.replace(/^.*[\\\/]/, ''),
								sourceName: fileSegments.join('.'),
								name: fileSegments.join('.'),
								created: fileStats.birthtime.getTime(),
								modified: fileStats.mtime.getTime(),
								original: template,
								input: '',
								blocks: []
							};

						// Check for front matter
						if (template.substring(0, 3) === '---') {
							var results = /^(---(?:\n|\r)([\w\W]+?)---)?([\w\W]*)*/.exec(template);

							// Merge YAML into the data
							if (results[2] !== undefined) {
								try {
									var front = yaml.load(results[2]);

									// Check for global data
									if (front.global) {
										data = Wee.$extend(front.global, data);
										delete front.global;
									}

									// Check for site data
									if (front.site) {
										data.site = Wee.$extend(front.site. data.site);
										delete front.site;
									}

									// Check for section data
									if (front.section) {
										data.section = Wee.$extend(front.section, data.section);
										delete front.section;
									}

									// Merge in YAML data
									obj = Wee.$extend(obj, front);
								} catch (e) {
									Wee.notify({
										title: 'Generator Error',
										message: 'There was a problem parsing the YAML'
									}, 'error');
								}
							}

							obj.original = results[3] ? results[3].trim() : '';
						}

						// Process content blocks
						var last = obj.original.length,
							regex = /(?:---(.+)---)\n/g,
							values = [],
							matches;

						// Loop through segment matches
						while ((matches = regex.exec(obj.original)) !== null) {
							var match = matches[1].trim(),
								segs = match.split('|');

							values.push({
								name: segs[0],
								helpers: segs.splice(1),
								start: matches.index,
								end: regex.lastIndex
							});
						}

						// Loop through segment values
						values.forEach(function(value, x) {
							// Calculate ending index
							var name = value.name,
								end = (x + 1) < values.length ?
									values[x + 1].start :
									last,
								helpers = value.helpers,
								content = obj.original.substr(value.end, end - value.end).trim();

							// Process primary content block
							if (x === 0 && value.start > 0) {
								obj.input = obj.original.substr(0, value.start);

								obj.blocks.push({
									name: 'content',
									input: obj.input,
									output: md.render(obj.input),
									render: true
								});
							}

							// Concatenate additional content blocks
							if (name === 'content') {
								obj.input += content;
							} else {
								var append = helpers.indexOf('append') !== -1,
									render = helpers.indexOf('render') !== -1,
									val = {
										name: name,
										input: content,
										output: md.render(content),
										render: render
									};

								// Check for block values
								helpers.forEach(function(helper) {
									if (helper.indexOf(':') !== -1) {
										var split = helper.split(':');

										val[split[0]] = split[1];
									}
								});

								// Handle array blocks
								if (append === true) {
									if (! obj.hasOwnProperty(name)) {
										obj[name] = [];
									}

									obj[name].push(val);
								} else {
									obj[name] = val;
								}

								obj.blocks.push(val);

								// Handle rendered block
								if (render === true) {
									obj.input += content;
								}
							}
						});

						// Handle basic content
						if (values.length === 0) {
							var rendered = md.render(obj.original);

							obj.input = obj.original;

							obj.blocks.push({
								name: 'content',
								input: obj.original,
								output: rendered,
								render: true
							});

							obj.output = rendered;
						} else {
							obj.output = md.render(obj.input);
						}

						// Push current content object in to content array
						data.content.push(obj);

						data.target = block.target;

						// Handle block ordering and sorting
						if (block.order) {
							data.content.sort(function(a, b) {
								if (a[block.order] < b[block.order]) {
									return -1;
								}

								if (a[block.order] > b[block.order]) {
									return 1;
								}

								return 0;
							});
						}

						if (block.sort === 'desc') {
							data.content.reverse();
						}

						if (single === true) {
							var dest = Wee.view.render(target, obj);
							data = generatePaths(data, dest);
							Wee.$extend(data, data.section.data);

							writeTarget(dest, Wee.$extend(data, {
								content: [obj]
							}));
						} else {
							data = generatePaths(data, target);
						}
					});

					if (single === false) {
						writeTarget(target, data);
					}
				});
			});
		};

		var tempPath = config.paths.temp + 'remote',
			remoteUrls = [],
			remotesDownloaded = 0,
			remoteIndex = 1,
			done;

		// Extract remote URLs
		var getRemotePaths = function(context) {
			var keys = Object.keys(context);

			keys.forEach(function(key) {
				var block = context[key];

				if (block.content) {
					Wee.$toArray(block.content).forEach(function(value, i) {
						if (value.substring(0, 4) === 'http') {
							var filename = '/remote-' + remoteIndex + '.html',
								absolutePath = tempPath + filename,
								relativePath = './' + path.relative(
										configPath,
										tempPath
									) + filename;

							remoteUrls.push([
								value,
								absolutePath
							]);
							remoteIndex++;

							// Inject temp path into content value
							if (typeof block.content === 'string') {
								block.content = relativePath;
							} else {
								block.content[i] = path.resolve(configPath, relativePath);
							}
						}
					});
				}

				if (block.sections) {
					getRemotePaths(block.sections);
				}
			});
		};

		getRemotePaths(json.sections);

		// Download all available remote content
		if (remoteUrls.length) {
			done = this.async();

			// Create remote cache directory
			fs.mkdirSync(tempPath);

			var cacheRemote = function(i) {
				var arr = remoteUrls[i],
					url = arr[0],
					http = url.substring(4, 5) === 's' ?
						require('https') :
						require('http'),
					tempFile = fs.createWriteStream(arr[1]);

				http.get(url, function(res) {
					res.on('data', function(chunk) {
						tempFile.write(chunk);
					}).on('end', function() {
						tempFile.end();

						remotesDownloaded++;

						// Continue processing if all remotes have been downloaded
						if (remotesDownloaded === remoteUrls.length) {
							processSection(json.sections);
							done();
						} else {
							cacheRemote(i + 1);
						}
					});
				}).on('error', function() {
					Wee.notify({
						title: 'Generation Error',
						message: 'There was a problem downloading ' + url
					}, 'error');

					fs.unlink(tempFile);
				});
			};

			cacheRemote(0);
		} else {
			processSection(json.sections);
		}

		// Reload browsers
		bs.reload();

		if (errors < 1) {
			Wee.notify({
				title: 'Generation Complete',
				message: 'Static site successfully built'
			});
		}
	});
};