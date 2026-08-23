$(function(){
    $.fn.prdImg = function(parm){
        var index = 0;
        var target = parm.target;
        var view = parm.view;
        var listWrap = target.find('.xans-product-addimage');
        var limit = listWrap.find('ul > li').length;
        var ul = target.find('.xans-product-addimage ul');
        var liFirst = target.find('.xans-product-addimage ul > li:first-child');
        var liWidth = parseInt(liFirst.width());
        var liHeight = parseInt(liFirst.height());
        var blockWidth = liWidth + parseInt(liFirst.css('marginRight')) + parseInt(liFirst.css('marginLeft'));
        var columWidth = blockWidth * view;
        var colum = Math.ceil(limit / view);

        var roll = {
            init : function(){
                function struct(){
                    var ulWidth = limit * parseInt(blockWidth);
                    ul.css({'position':'absolute', 'left':0, 'top':0, 'width':ulWidth});
                    listWrap.find('ul > li').each(function(){
                        $(this).css({'float':'left'});
                    });

                    var prev = listWrap.find('.prev');
                    var next = listWrap.find('.next');

                    prev.on('click', function(){
                        if(index > 0){
                            index --;
                        }
                        roll.slide(index);
                    });
                    next.on('click', function(){
                        if(index < (colum-1) ){
                            index ++;
                        }
                        roll.slide(index);
                    });
                   
                }
                if(limit > view){
                    struct();
                }
            },
            slide : function(index){
                var left = '-' + (index * columWidth) +'px';
                var prev = listWrap.find('.prev');
                var next = listWrap.find('.next');
             
                ul.stop().animate({'left':left},500);
            }
        }
        roll.init();
    };

    $.fn.prdImg({
        target : $('.xans-product-image'),
        view : 3
    });

    $.fn.prdImg({
        target : $('.xans-product-zoom'),
        view : 3
    });

});