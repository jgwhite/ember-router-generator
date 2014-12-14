module.exports = EmberRouterGenerator;

var cloneDeep = require('lodash-node/modern/objects/cloneDeep');
var escodegen = require('escodegen');
var esprima   = require('esprima');
var traverse  = require('es-simpler-traverser');

var Scope     = require('./scope');
var DefineCallExpression = require('./visitors/define-call-expression.js');

var findFunctionExpression = require('./helpers/find-function-expression');
var hasRoute               = require('./helpers/has-route');
var newFunctionExpression  = require('./helpers/new-function-expression');
var resourceNode           = require('./helpers/resource-node');
var routeNode              = require('./helpers/route-node');

function EmberRouterGenerator(source, ast) {
  this.source = source;
  this.ast = ast;
  this.mapNode = null;
  this.scope = new Scope();

  this.visitors = {
    CallExpression: new DefineCallExpression(this.scope, this)
  };

  this._ast();
  this._walk();
}

EmberRouterGenerator.prototype.clone = function() {
  var route = new EmberRouterGenerator(this.source, cloneDeep(this.ast));

  route.scope   = cloneDeep(this.scope);
  route.mapNode   = cloneDeep(this.mapNode);
  route._walk();

  return route;
};

EmberRouterGenerator.prototype._ast  = function() {
  this.ast = this.ast || esprima.parse(this.source);
};

EmberRouterGenerator.prototype._walk  = function() {
  var scope = this.scope;
  var visitors = this.visitors;

  traverse(this.ast, {
    exit: function(node) {
      var visitor = visitors[node.type];

      if (visitor && typeof visitor.exit === 'function') {
        visitor.exit(node);
      }
    },

    enter: function(node) {
      var visitor = visitors[node.type];

      if (visitor && typeof visitor.enter === 'function') {
        visitor.enter(node);
      }
    }
  });
};

EmberRouterGenerator.prototype.add = function(routeName, options) {
  if (typeof this.mapNode === 'undefined') {
    throw new Error('Source doesn\'t include Ember.map');
  }

  var route = this.clone();
  var routes  = route.mapNode.arguments[0].body.body;

  route._add.call(
    route,
    routeName.split('/'),
    routes,
    options
  );

  return route;
};



EmberRouterGenerator.prototype._add = function(nameParts, routes, options) {
  options = options || {};
  var parent   =  nameParts[0];
  var name     = parent;
  var children = nameParts.slice(1);
  var route    = hasRoute(parent, routes);

  if (!route) {
    if (options.type === 'resource') {
      route = resourceNode(name);
      routes.push(route);
    } else {
      route = routeNode(name);
      routes.push(route);
    }
  }

  if (children.length > 0) {
    var routesFunction = findFunctionExpression(route.expression.arguments);

    if (!routesFunction) {
      routesFunction = newFunctionExpression();
      route.expression.arguments.push(routesFunction);
    }

    this._add(children, routesFunction.body.body, options);
  }
};