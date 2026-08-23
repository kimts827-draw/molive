window.addEventListener('load', function(){
	orderHeadDate();
});

function orderHeadDate(){
    var search = document.querySelector(".xans-myshop-orderhistoryhead .eDataSet");
    if(!search) return;
    search.addEventListener('click', function(){        
        OrderHistory.set_period_mode('search');
    });
}
