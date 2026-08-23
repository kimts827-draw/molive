window.addEventListener('load', function(){
    swiperVisual();
    swiperLazyInit();
	saleItemTab();
    videoLoad();
});

function swiperVisual() {
    var swipeKeyVisual = new Swiper('.mainVisual .swiper-container', {
        spaceBetween: 30,
        centeredSlides: true,
        loop: true,
        autoplay: {
            delay: 2500,
            disableOnInteraction: false,
        },
        effect: 'fade',
        pagination: {
            el: '.mainVisual .swiper-pagination',
            clickable : true,
        },
        navigation: {
            nextEl: '.mainVisual .swiper-button-next',
            prevEl: '.mainVisual .swiper-button-prev',
        }
    });
	var btnSwiperPause = document.querySelector('.swiper-button-pause');
    if(!btnSwiperPause) return;
    btnSwiperPause.addEventListener('click', function(){
        swipeKeyVisual.autoplay.stop();            
        this.parentNode.classList.add('on');
    });
    var btnSwiperPlay = document.querySelector('.swiper-button-play');
    if(!btnSwiperPlay) return;
    btnSwiperPlay.addEventListener('click', function(){
        swipeKeyVisual.autoplay.start();            
        this.parentNode.classList.remove('on');
    });
}

function swiperLazyInit() {
    var swiperList = document.querySelectorAll('.swiper-container.swiper-lazy-init');
    if (swiperList && swiperList.length > 0) {
        
        var swiperObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.intersectionRatio > 0) {
                    init(entry.target);
                }
            });
        }, { rootMargin: '50px' });
        
        swiperList.forEach(function (swiper) {
            swiperObserver.observe(swiper);
        });
    }
    
    function init(container) {
        if (container.classList.contains('swiper-container-initialized') === false) {
            new Swiper(container, {
                navigation: {
                    nextEl: '.item-wrapper .swiper-button-next',
                    prevEl: '.item-wrapper .swiper-button-prev',
                    },
                scrollbar: {
                    el: '.item-wrapper .swiper-scrollbar',
                },
                slidesPerView: 2,
                breakpoints: {
                    768: {
                        slidesPerView: 2,
                        spaceBetween: 10,
                    },
                    1024: {
                        slidesPerView: 3,
                        spaceBetween: 16,
                    },
                }
            })
        }
    }
}

function saleItemTab() {
    var saleItem = document.querySelector('.saleItem');
    if(!saleItem) return;
    var tabButtonList = saleItem.querySelectorAll('.menu > li > .button');

    tabButtonList.forEach(function(button) {
        button.addEventListener('click', handleClickButton);
        setTitle(button);
    });

    function handleClickButton(e) {
        var currentButton = e.target;
        tabButtonList.forEach(function(button) {
            button.classList.remove('active');
        });
        currentButton.classList.add('active');

        var contentId = currentButton.getAttribute('data-id');
        var currentContent = saleItem.querySelector('#' + contentId);
        var tabContentList = saleItem.querySelectorAll('.tabContent');
        tabContentList.forEach(function(content) {
            content.classList.remove('active');
        });
        currentContent.classList.add('active');
    }

    function setTitle(button) {
        var contentId = button.getAttribute('data-id');
        var targetContent = saleItem.querySelector('#' + contentId);
        var mainTitle = targetContent.querySelector('.mainTitle');
        var title = '';
        if (mainTitle) {
            title = mainTitle.textContent;
        }
        button.innerText = title;
    }
}

function videoLoad() {
    var videoLink = document.querySelector('.linkVideo');
    if(!videoLink) return;
    videoLink.addEventListener('click', function(){
        var video = document.querySelector('#video');
        var source = video.querySelector('source');
        if(source.getAttribute('src') === null) {
            source.setAttribute('src', source.getAttribute('data-src'));
            video.load();
        }
        video.play();
    });
}
