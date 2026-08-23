/**
 * 카테고리 리스트 상품 정렬
 */
var aUrl = location.href.split('?');
var sQueryString = aUrl[1];
var orgHeaderHeight = 0;
var selAdd = 0;
var maxTime = 5;

/**
 * 파라미터가 있을경우에만 처리
 */
$(function(){
    if (sQueryString && sQueryString.indexOf('sort_method') > -1) {
        for (var i=0; i<$('#selArray option').length; i++) {
            if ($('#selArray option').eq(i).val().indexOf(sQueryString) > -1) {
                $('#selArray option').eq(i).prop("selected", true);

                orgHeaderHeight = $('#header').outerHeight(true);
                fixedClassCheck();
            }
        }
    }
});

$('#selArray').on('change', function() {
    if ($('#selArray').val()) {
        location.href=$('#selArray').val();
    }
});

function goThumg(url) {
    location.href = url+'?'+sQueryString;
}

function fixedClassCheck(){
    var fixedBol = $('#header').hasClass('fixed');
    if(!fixedBol){
        if(selAdd < maxTime){ setTimeout(fixedClassCheck,100); }
        selAdd++;
    }else{
        var fixedHeader = $('#header').find('.navigation').outerHeight(true),
            scrollValue = $(document).scrollTop(),
            scrollTop = scrollValue - (orgHeaderHeight+fixedHeader);

        if(scrollTop > 0){ $(document).scrollTop(scrollTop); }
    }
}