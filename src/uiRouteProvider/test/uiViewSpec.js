'use strict';

describe('uiView', function() {
  var element;

  beforeEach(module(function() {
    return function($rootScope, $compile) {
      element = $compile('<ui:view onload="load()"></ui:view>')($rootScope);
    };
  }));


  afterEach(function(){
    dealoc(element);
  });


  it('should do nothing when no routes are defined',
      inject(function($rootScope, $compile, $location) {
    $location.path('/unknown');
    $rootScope.$digest();
    expect(element.text()).toEqual('');
  }));


  it('should instantiate controller after compiling the content', function() {
    var log = [], controllerScope,
        Ctrl = function($scope) {
          controllerScope = $scope;
          log.push('ctrl-init');
        };

    module(function($compileProvider, $uiRouteProvider) {
      $compileProvider.directive('compileLog', function() {
        return {
          compile: function() {
            log.push('compile');
          }
        };
      });

      $uiRouteProvider.when('/some', {templateUrl: '/tpl.html', controller: Ctrl});
    });

    inject(function($uiRoute, $rootScope, $templateCache, $location) {
      $templateCache.put('/tpl.html', [200, '<div compile-log>partial</div>', {}]);
      $location.path('/some');
      $rootScope.$digest();

      expect(controllerScope.$parent).toBe($rootScope);
      expect(controllerScope).toBe($uiRoute.current.scope);
      expect(log).toEqual(['compile', 'ctrl-init']);
    });
  });


  it('should support string controller declaration', function() {
    var MyCtrl = jasmine.createSpy('MyCtrl');

    module(function($controllerProvider, $uiRouteProvider) {
      $controllerProvider.register('MyCtrl', ['$scope', MyCtrl]);
      $uiRouteProvider.when('/foo', {controller: 'MyCtrl', templateUrl: '/tpl.html'});
    });

    inject(function($uiRoute, $location, $rootScope, $templateCache) {
      $templateCache.put('/tpl.html', [200, '<div></div>', {}]);
      $location.path('/foo');
      $rootScope.$digest();

      expect($uiRoute.current.controller).toBe('MyCtrl');
      expect(MyCtrl).toHaveBeenCalledWith(element.contents().scope());
    });
  });


  it('should load content via xhr when route changes', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {templateUrl: 'myUrl1'});
      $uiRouteProvider.when('/bar', {templateUrl: 'myUrl2'});
    });

    inject(function($rootScope, $compile, $httpBackend, $location, $uiRoute) {
      expect(element.text()).toEqual('');

      $location.path('/foo');
      $httpBackend.expect('GET', 'myUrl1').respond('<div>{{1+3}}</div>');
      $rootScope.$digest();
      $httpBackend.flush();
      expect(element.text()).toEqual('4');

      $location.path('/bar');
      $httpBackend.expect('GET', 'myUrl2').respond('angular is da best');
      $rootScope.$digest();
      $httpBackend.flush();
      expect(element.text()).toEqual('angular is da best');
    });
  });


  it('should use inline content route changes', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {template: '<div>{{1+3}}</div>'});
      $uiRouteProvider.when('/bar', {template: 'angular is da best'});
      $uiRouteProvider.when('/blank', {template: ''});
    });

    inject(function($rootScope, $compile, $location, $uiRoute) {
      expect(element.text()).toEqual('');

      $location.path('/foo');
      $rootScope.$digest();
      expect(element.text()).toEqual('4');

      $location.path('/bar');
      $rootScope.$digest();
      expect(element.text()).toEqual('angular is da best');

      $location.path('/blank');
      $rootScope.$digest();
      expect(element.text()).toEqual('');
    });
  });


  it('should remove all content when location changes to an unknown route', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {templateUrl: 'myUrl1'});
    });

    inject(function($rootScope, $compile, $location, $httpBackend, $uiRoute) {
      $location.path('/foo');
      $httpBackend.expect('GET', 'myUrl1').respond('<div>{{1+3}}</div>');
      $rootScope.$digest();
      $httpBackend.flush();
      expect(element.text()).toEqual('4');

      $location.path('/unknown');
      $rootScope.$digest();
      expect(element.text()).toEqual('');
    });
  });


  it('should chain scopes and propagate evals to the child scope', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {templateUrl: 'myUrl1'});
    });

    inject(function($rootScope, $compile, $location, $httpBackend, $uiRoute) {
      $rootScope.parentVar = 'parent';

      $location.path('/foo');
      $httpBackend.expect('GET', 'myUrl1').respond('<div>{{parentVar}}</div>');
      $rootScope.$digest();
      $httpBackend.flush();
      expect(element.text()).toEqual('parent');

      $rootScope.parentVar = 'new parent';
      $rootScope.$digest();
      expect(element.text()).toEqual('new parent');
    });
  });


  it('should be possible to nest uiView in ngInclude', function() {

    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {templateUrl: 'viewPartial.html'});
    });

    inject(function($httpBackend, $location, $uiRoute, $compile, $rootScope) {
      $httpBackend.whenGET('includePartial.html').respond('view: <ui:view></ui:view>');
      $httpBackend.whenGET('viewPartial.html').respond('content');
      $location.path('/foo');

      var elm = $compile(
        '<div>' +
          'include: <ng:include src="\'includePartial.html\'"> </ng:include>' +
        '</div>')($rootScope);
      $rootScope.$digest();
      $httpBackend.flush();

      expect(elm.text()).toEqual('include: view: content');
      expect($uiRoute.current.templateUrl).toEqual('viewPartial.html');
      dealoc(elm)
    });
  });


  it('should initialize view template after the view controller was initialized even when ' +
     'templates were cached', function() {
     //this is a test for a regression that was introduced by making the ui-view cache sync
    function ParentCtrl($scope) {
       $scope.log.push('parent');
    }

    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {controller: ParentCtrl, templateUrl: 'viewPartial.html'});
    });


    inject(function($rootScope, $compile, $location, $httpBackend, $uiRoute) {
      $rootScope.log = [];

      $rootScope.ChildCtrl = function($scope) {
        $scope.log.push('child');
      };

      $location.path('/foo');
      $httpBackend.expect('GET', 'viewPartial.html').
          respond('<div ng-init="log.push(\'init\')">' +
                    '<div ng-controller="ChildCtrl"></div>' +
                  '</div>');
      $rootScope.$apply();
      $httpBackend.flush();

      expect($rootScope.log).toEqual(['parent', 'init', 'child']);

      $location.path('/');
      $rootScope.$apply();
      expect($rootScope.log).toEqual(['parent', 'init', 'child']);

      $rootScope.log = [];
      $location.path('/foo');
      $rootScope.$apply();

      expect($rootScope.log).toEqual(['parent', 'init', 'child']);
    });
  });


  it('should discard pending xhr callbacks if a new route is requested before the current ' +
      'finished loading',  function() {
    // this is a test for a bad race condition that affected feedback

    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {templateUrl: 'myUrl1'});
      $uiRouteProvider.when('/bar', {templateUrl: 'myUrl2'});
    });

    inject(function($uiRoute, $rootScope, $location, $httpBackend) {
      expect(element.text()).toEqual('');

      $location.path('/foo');
      $httpBackend.expect('GET', 'myUrl1').respond('<div>{{1+3}}</div>');
      $rootScope.$digest();
      $location.path('/bar');
      $httpBackend.expect('GET', 'myUrl2').respond('<div>{{1+1}}</div>');
      $rootScope.$digest();
      $httpBackend.flush(); // now that we have two requests pending, flush!

      expect(element.text()).toEqual('2');
    });
  });


  it('should be async even if served from cache', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {controller: noop, templateUrl: 'myUrl1'});
    });

    inject(function($uiRoute, $rootScope, $location, $templateCache) {
      $templateCache.put('myUrl1', [200, 'my partial', {}]);
      $location.path('/foo');

      var called = 0;
      // we want to assert only during first watch
      $rootScope.$watch(function() {
        if (!called++) expect(element.text()).toBe('');
      });

      $rootScope.$digest();
      expect(element.text()).toBe('my partial');
    });
  });

  it('should fire $contentLoaded event when content compiled and linked', function() {
    var log = [];
    var logger = function(name) {
      return function() {
        log.push(name);
      };
    };
    var Ctrl = function($scope) {
      $scope.value = 'bound-value';
      log.push('init-ctrl');
    };

    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {templateUrl: 'tpl.html', controller: Ctrl});
    });

    inject(function($templateCache, $rootScope, $location) {
      $rootScope.$on('$uiRouteChangeStart', logger('$uiRouteChangeStart'));
      $rootScope.$on('$uiRouteChangeSuccess', logger('$uiRouteChangeSuccess'));
      $rootScope.$on('$viewContentLoaded', logger('$viewContentLoaded'));

      $templateCache.put('tpl.html', [200, '{{value}}', {}]);
      $location.path('/foo');
      $rootScope.$digest();

      expect(element.text()).toBe('bound-value');
      expect(log).toEqual([
        '$uiRouteChangeStart', 'init-ctrl', '$viewContentLoaded', '$uiRouteChangeSuccess' ]);
    });
  });

  it('should destroy previous scope', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {templateUrl: 'tpl.html'});
    });

    inject(function($templateCache, $rootScope, $location) {
      $templateCache.put('tpl.html', [200, 'partial', {}]);

      expect($rootScope.$$childHead).toBeNull();
      expect($rootScope.$$childTail).toBeNull();

      $location.path('/foo');
      $rootScope.$digest();

      expect(element.text()).toBe('partial');
      expect($rootScope.$$childHead).not.toBeNull();
      expect($rootScope.$$childTail).not.toBeNull();

      $location.path('/non/existing/route');
      $rootScope.$digest();

      expect(element.text()).toBe('');
      expect($rootScope.$$childHead).toBeNull();
      expect($rootScope.$$childTail).toBeNull();
    });
  });


  it('should destroy previous scope if multiple route changes occur before server responds',
      function() {
    var log = [];
    var createCtrl = function(name) {
      return function($scope) {
        log.push('init-' + name);
        $scope.$on('$destroy', function() {log.push('destroy-' + name);});
      };
    };

    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/one', {templateUrl: 'one.html', controller: createCtrl('ctrl1')});
      $uiRouteProvider.when('/two', {templateUrl: 'two.html', controller: createCtrl('ctrl2')});
    });

    inject(function($httpBackend, $rootScope, $location) {
      $httpBackend.whenGET('one.html').respond('content 1');
      $httpBackend.whenGET('two.html').respond('content 2');

      $location.path('/one');
      $rootScope.$digest();
      $location.path('/two');
      $rootScope.$digest();

      $httpBackend.flush();
      expect(element.text()).toBe('content 2');
      expect(log).toEqual(['init-ctrl2']);

      $location.path('/non-existing');
      $rootScope.$digest();

      expect(element.text()).toBe('');
      expect(log).toEqual(['init-ctrl2', 'destroy-ctrl2']);

      expect($rootScope.$$childHead).toBeNull();
      expect($rootScope.$$childTail).toBeNull();
    });
  });


  it('should $destroy scope after update and reload',  function() {
    // this is a regression of bug, where $uiRoute doesn't copy scope when only updating

    var log = [];

    function logger(msg) {
      return function() {
        log.push(msg);
      };
    }

    function createController(name) {
      return function($scope) {
        log.push('init-' + name);
        $scope.$on('$destroy', logger('destroy-' + name));
        $scope.$on('$uiRouteUpdate', logger('route-update'));
      };
    }

    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/bar', {templateUrl: 'tpl.html', controller: createController('bar')});
      $uiRouteProvider.when('/foo', {
          templateUrl: 'tpl.html', controller: createController('foo'), reloadOnSearch: false});
    });

    inject(function($templateCache, $location, $rootScope) {
      $templateCache.put('tpl.html', [200, 'partial', {}]);

      $location.url('/foo');
      $rootScope.$digest();
      expect(log).toEqual(['init-foo']);

      $location.search({q: 'some'});
      $rootScope.$digest();
      expect(log).toEqual(['init-foo', 'route-update']);

      $location.url('/bar');
      $rootScope.$digest();
      expect(log).toEqual(['init-foo', 'route-update', 'destroy-foo', 'init-bar']);
    });
  });


  it('should evaluate onload expression after linking the content', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {templateUrl: 'tpl.html'});
    });

    inject(function($templateCache, $location, $rootScope) {
      $templateCache.put('tpl.html', [200, '{{1+1}}', {}]);
      $rootScope.load = jasmine.createSpy('onload');

      $location.url('/foo');
      $rootScope.$digest();
      expect($rootScope.load).toHaveBeenCalledOnce();
    });
  })


  it('should set $scope and $controllerController on the view', function() {
    function MyCtrl($scope) {
      $scope.state = 'WORKS';
      $scope.ctrl = this;
    }

    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {templateUrl: 'tpl.html', controller: MyCtrl});
    });

    inject(function($templateCache, $location, $rootScope, $uiRoute) {
      $templateCache.put('tpl.html', [200, '<div>{{state}}</div>', {}]);

      $location.url('/foo');
      $rootScope.$digest();
      expect(element.text()).toEqual('WORKS');

      var div = element.find('div');
      expect(nodeName_(div.parent())).toEqual('NG:VIEW');

      expect(div.scope()).toBe($uiRoute.current.scope);
      expect(div.scope().hasOwnProperty('state')).toBe(true);
      expect(div.scope().state).toEqual('WORKS');

      expect(div.controller()).toBe($uiRoute.current.scope.ctrl);
    });
  });
});