define(function(require) {
	var registerSuite = require('intern!object'),
		assert = require('intern/chai!assert');

	require('js/tests/support/exports.js');

	registerSuite({
		name: 'Data',

		request: {
			get: {
				file: function() {
					var promise = this.async(1000);

					// TODO: File path is relative to wee-core. Need solution that
					// TODO: uses conditional path that works with Browsersync as well.
					Wee.data.request({
						url: '/js/tests/sample-files/sample.json',
						json: true,
						success: promise.callback(function(data) {
							assert.strictEqual(data.person.firstName, 'Don',
								'Sample file was not loaded successfully'
							);
						})
					});
				},

				'query string': function() {
					var promise = this.async(1000);

					Wee.data.request({
						url: 'https://httpbin.org/get?test=test',
						method: 'get',
						json: true,
						success: promise.callback(function(data) {
							assert.equal(data.args.test,
								'test',
								'Data was not posted successfully'
							);
						})
					});
				},

				'response type': function() {
					var promise = this.async(1000);

					Wee.data.request({
						url: 'https://httpbin.org/get?test=test',
						method: 'get',
						responseType: 'json',
						success: promise.callback(function(data) {
							assert.equal(data.args.test,
								'test',
								'Data was not posted successfully'
							);
						})
					});
				}
			},


			post: {
				data: function() {
					var promise = this.async(1000);

					Wee.data.request({
						url: 'https://httpbin.org/post',
						method: 'post',
						json: true,
						data: {
							test: 'test'
						},
						success: promise.callback(function(data) {
							var response = JSON.parse(data.data);

							assert.equal(response.test,
								'test',
								'Data was not posted successfully'
							);
						})
					});
				},

				'query string': function() {
					var promise = this.async(1000);

					Wee.data.request({
						url: 'https://httpbin.org/get?test=test',
						method: 'get',
						json: true,
						success: promise.callback(function(data) {
							assert.equal(data.args.test,
								'test',
								'Data was not posted successfully'
							);
						})
					});
				}
			},

			JSONP: function() {
				// TODO: Complete
				assert.isTrue(true);
			}
		}
	});
});