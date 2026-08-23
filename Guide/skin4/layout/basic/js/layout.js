window.addEventListener('load', function(){
	bottomNav();
    fixedHeader();
    handleNav();
    quickGoTop();
    searchLayer();
    toggleClass('.xans-layout-info.info__customer', '.xans-layout-info.info__customer .toggle', 'selected');
    topBanner();
	handleScroll();
});

function handleScroll(){
	var scrollPosition = 0;
	var ticking = false;
	var quickMenu = document.querySelector('#quick');
	var scrollY = window.scrollY || window.pageYOffset;
	setQuickScrollEvent(scrollY, quickMenu);
	window.addEventListener('scroll', function(e) {
        scrollPosition = window.scrollY || window.pageYOffset;
        if (ticking) return;
        window.requestAnimationFrame(function() {
            fixedHeader()
            setQuickScrollEvent(scrollPosition, quickMenu)
            ticking = false;
        });
        ticking = true;
	});
}

function toggleClass(element, handler, className){
	var _handler = document.querySelector(handler);
	var _element = document.querySelector(element);

    _handler.addEventListener('click', function(){
        if ( _element.classList.contains(className) ) {
            _element.classList.remove( className );
        } else {
            _element.classList.add( className );
        }
    });
}

function fixedHeader() {
    var header = document.getElementById("header");
	var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    if(scrollY > header.offsetTop) {
        header.classList.add("fixed");
    } else {
        header.classList.remove("fixed");
    }
}

function handleNav() {
    var btnNavs = document.querySelectorAll('.eNavFold');
    var btnClose = document.querySelector('#aside .btnClose');
    var dimmed = document.querySelector('#layoutDimmed');
    var elements = document.getElementsByClassName("test");
    btnNavs.forEach( function(btnNav) {
        btnNav.addEventListener('click', function(){
            document.body.classList.add('expand');
        });
    });
    btnClose.addEventListener('click', function(){
        document.body.classList.remove('expand');
    });
    handleDimmed(dimmed, document.body, 'expand');
}


function searchLayer() {
    var btnSearchs = document.querySelectorAll('.eSearch');
    var btnClose = document.querySelector('.xans-layout-searchheader  .btnClose');
    btnSearchs.forEach( function(btnSearch) {
        btnSearch.addEventListener('click', function(){
            document.body.classList.add('searchExpand');
            var input = document.querySelector('#keyword');
            input.focus();
        });
    });
    btnClose.addEventListener('click', function(){
        document.body.classList.remove('searchExpand');
    });
    var dimmed = document.querySelector('#layoutDimmed');
    handleDimmed(dimmed, document.body, 'searchExpand');
}

function handleDimmed(target, element, className){
    target.addEventListener('click', function(){
        element.classList.remove(className);
    });
}

function bottomScroll(){
    var lastScrollTop = 0;
    var delta = 5;
    var fixBox = document.querySelector('.bottom-nav__top');
    var fixBoxHeight = fixBox.offsetHeight;
    var didScroll;
    
    window.onscroll = function(e) {
        didScroll = true;
    };

    setInterval(function(){
        if(didScroll){
            hasScrolled();
            didScroll = false;
        }
    }, 250);

    function hasScrolled(){
        var nowScrollTop = window.scrollY;
        if(Math.abs(lastScrollTop - nowScrollTop) <= delta){
            return;
        }
        if(nowScrollTop > lastScrollTop && nowScrollTop > fixBoxHeight){
            //Scroll down
            var scrollTop = window.scrollTop();
            var innerHeight = window.innerHeight();
            var scrollHeight = $('body').prop('scrollHeight');
            if (scrollTop + innerHeight >= scrollHeight) {
                fixBox.classList.add('bottom-nav--hide');
                return true;
            }
        }else{
            if(nowScrollTop + window.innerHeight < document.body.offsetHeight){
                //Scroll up
                fixBox.classList.remove('bottom-nav--hide');
            }
        }
        lastScrollTop = nowScrollTop;
    }
}

function bottomNav(){
    var lastScrollTop = 0;
    var btnTop = document.querySelector('.bottom-nav__top');
    var fixedButton = document.getElementById("orderFixArea");
    if(fixedButton){
        document.body.classList.add("button--fixed");
    };

	window.addEventListener("scroll", function(){
		var scroll = window.pageYOffset || document.documentElement.scrollTop;
        var nav = document.querySelector('.bottom-nav');
		if (scroll > lastScrollTop){
			nav.classList.add('bottom-nav--hide');
		} else {
			nav.classList.remove('bottom-nav--hide');
		}
		// scroll bottom
		if(scroll === document.body.scrollHeight - document.documentElement.offsetHeight){
			nav.classList.remove('bottom-nav--hide');
		}
		lastScrollTop = scroll <= 0 ? 0 : scroll;
        
        // top button
        var currentScrollPercentage = getCurrentScrollPercentage();
        if(currentScrollPercentage > 30){
        	btnTop.classList.add('bottom-nav__top--show');
        } else {
			btnTop.classList.remove('bottom-nav__top--show');
        }
	});
    
    btnTop.addEventListener('click', function(){
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
    });
}

function getOffset(element){
    if (!element.getClientRects().length)
    {
      return { top: 0, left: 0 };
    }

    var rect = element.getBoundingClientRect();
    var win = element.ownerDocument.defaultView;
    return (
    {
      top: rect.top + win.pageYOffset,
      left: rect.left + win.pageXOffset
    });   
}

function getQuickPosition(){
	var role = document.querySelector("meta[name='path_role']").getAttribute('content');
	if (role === "MAIN") {
		return getMainQuickPosition();
	} else {
		return getSubQuickPosition();
	}
}

function getMainQuickPosition(){
	var quickMenu = document.querySelector('#quick');
	var collection = document.querySelector('.collection');
	var snsItem = document.querySelector('.snsItem');

	var mainTopSpace = 115;
	var mainFooterSpace = 34;

	var top = collection.offsetTop + collection.clientHeight + mainTopSpace;
    var footTop = getOffset(snsItem).top + mainFooterSpace;
	var maxY = footTop - quickMenu.offsetHeight;

	return [top, maxY]
}

function getSubQuickPosition(){
	var quickMenu = document.querySelector('#quick');
	var footer = document.querySelector("#footer");

	var footerSpace = 60;
	var top = 284;
    var footTop = getOffset(footer).top;
	var maxY = footTop - quickMenu.offsetHeight - footerSpace;

	return [top, maxY]
}

function setQuickScrollEvent(y, quick){
	var header = document.querySelector('#header');
	var position = getQuickPosition();
	var scrollY = y;
	if (scrollY >= position[0] - header.offsetHeight){
		if (scrollY < position[1]) {
			quick.classList.add('fixed');
			quick.removeAttribute('style');
        } else {
			quick.classList.remove('fixed');
			quick.style.position = 'absolute';
			quick.style.top = position[1] + 'px';
        }
	} else {
		quick.style.top = position[0] + 'px';
        quick.classList.remove('fixed');
    }
}

function quickGoTop(){
    var btnTop = document.querySelector('#quick .pageTop');
	btnTop.addEventListener('click', function(){
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
    });
}

function topBanner(){
    var banner = document.querySelector('#topBanner');
    if(!banner) return;
    var btnClose = banner.querySelector('.btnClose');
    btnClose.addEventListener('click', function(){
        banner.classList.add("hidden");
    });
}


function getCurrentScrollPercentage(){
	return (window.scrollY + window.innerHeight) / document.body.clientHeight * 100
}