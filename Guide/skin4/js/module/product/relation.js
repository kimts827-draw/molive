function relatiionMore(){
    var relation = document.querySelector(".xans-product-relationlist");
    if(!relation){
        return;
    }
	var list = relation.querySelectorAll(".prdList__item");
    var btnMore = relation.querySelector(".btnMore");
    for(var i = 0; i < list.length; i++){
        if(list.length > 5){
            btnMore.addEventListener('click', function(){
                relation.classList.add("showAll");
                btnMore.style.display = "none";
            });
        } else {
            btnMore.style.display = "none";
        }
    }
}
relatiionMore();