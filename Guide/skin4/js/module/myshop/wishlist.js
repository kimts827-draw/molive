window.addEventListener('load', function(){
	wishlistSelectAll();
});

function wishlistSelectAll() {
    var btnSelectAll = document.querySelector('#product_select_all');
    if(!btnSelectAll) return;
    var status = btnSelectAll.dataset.status;
    btnSelectAll.addEventListener('click', function(){
        var checkbox = document.querySelectorAll('[id^="wish_idx_"]');
        for(var i = 0; i < checkbox.length; i++){
            var isChecked = checkbox[i].checked;
            if(status === 'off'){
                if(isChecked === false) checkbox[i].checked = true;
            } else {
                checkbox[i].checked = false;
            }
        }
        status = status === 'off' ? 'on' : 'off';
    });
}
