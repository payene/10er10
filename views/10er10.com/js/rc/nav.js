(function() {
  
  angular.module("d10nav",[])
  .directive("d10insideNav",function() {
    return {
      restrict: "A",
      replace: false,
      templateUrl: '../html/rc/nav/inside.html'
    };
  });
  
})();