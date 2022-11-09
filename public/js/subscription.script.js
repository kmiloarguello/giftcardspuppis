const Subscriptions = {
    subscriptions : [], // all subscriptions rendered
    subscription: {}, // current subscription to update
    elementId: null, // current modal id
    page: 1, // Initial page
    size: 50, // Number of rows to show
    limitSearch: 20, // Limit page when searching with an email
    email : null, // current email to seach

    init () {
        console.log("-- Subscriptions --");
        this.getSubscriptions();
        this.events();
        this.initModal();
    },

    events () {
        $(document)
            .on("click", ".nofilter", function () { Subscriptions.filterByStatus(this,"") })
            .on("click", ".filter-by-active", function () { Subscriptions.filterByStatus(this, "ACTIVE") })
            .on("click", ".filter-by-paused", function () { Subscriptions.filterByStatus(this, "PAUSED") })
            .on("click", ".filter-by-canceled", function () { Subscriptions.filterByStatus(this, "CANCELED")})
            .on("click", ".btn-page", function () {
                const newPage = parseInt($(this).attr("data-page"));
                Subscriptions.getSubscriptions(newPage, this.size);
            })
            .on("click", ".prev-page", () => this.getSubscriptions(Math.abs(this.page - 1), this.size))
            .on("click", ".next-page", () => this.getSubscriptions(this.page + 1, this.size))
            .on("click", "ul.items li.item", function () { Subscriptions.launchProductModal($(this).attr("data-sku")) })
            .on("change", "input#email_inline", function () { Subscriptions.setEmail($(this).val()) })
            .on("click", "button.search-by-email", function (event) { Subscriptions.searchByEmail(event, Subscriptions.email) })
            .on("click", ".cancel-subscription", function () { Subscriptions.launchConfirmationModal($(this).attr("id"),"subscription-cancel-confirmation","CANCELED") })
            .on("click", ".activate-subscription", function () { Subscriptions.launchConfirmationModal($(this).attr("id"),"subscription-activate-confirmation","ACTIVE") })
            .on("click", ".confirm-cancel-suscription,.confirm-activate-suscription", () => this.confirmUpdateSubscription())
            .on("click", ".login-with-email", function (event) {
                event.preventDefault();

                const email = $("input#email_inline").val();
                const password = $("input#password").val();
                
                if (!email || !password) return M.toast({html: 'Completa los datos!'});
                if (!Subscriptions.isAValidEmail(email)) return M.toast({ html: 'Email no válido!' });
                Subscriptions.loginWithEmailAndCode(email, password);
            })
            
    },

    setEmail (email) {
        this.email = email;
    },

    loginWithEmailAndCode (email, code) {
        if (!email || !code) return console.error("Missed data");

        this._postLogin(email, code)
            .then(res => {
                if (res.status >= 400) {
                    M.toast({html: 'Datos no válidos!'});
                } else {
                    return res.json();
                }
            })
            .then(data => {
                document.cookie = `subscriptiontempkey=${data.token}`;
                location.href = "/suscripciones/redirect";
            })
            .catch(err => console.error(err));
    },

    initModal () {
        document.addEventListener('DOMContentLoaded', function() {
            var elems = document.querySelectorAll('.modal');
            M.Modal.init(elems);
        });

        $('.modal').modal();
    },

    isAValidEmail (email) {
        if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)){
            return true;
        }
        return false;
    },

    searchByEmail(event, email) {
        event.preventDefault(); // prevent reloads before the code

        if (!email) return;
        if (!this.isAValidEmail(email)) return M.toast({ html: 'Email no valido!' });
        
        this.renderLoadingSubscriptions();
        let reqSubscriptions = [];
        const SIZE = 50;

        for (let i=1;i<this.limitSearch;i++) {
            reqSubscriptions.push(this._getSubscriptions(i, SIZE));
        }

        Promise.all(reqSubscriptions)
            .then(results => {
                const _results = results.map(subscriptions => { 
                    const foundSubscriptions = subscriptions.filter(subscription => subscription.customerEmail == email);
                    if (foundSubscriptions.length > 0) return foundSubscriptions;
                });
                const foundResults = _results.filter(subscriptions => typeof subscriptions != "undefined");
                
                let renderResults = [];
                foundResults.map(foundSubscriptions => foundSubscriptions.map(subscription => renderResults.push(subscription)));
                
                if (renderResults.length > 0) {
                    this.updateRenderSubscriptions(renderResults);
                } else {
                    M.toast({html: 'Email no encontrado!'});
                    this.renderEmptySubscriptions();
                }
            })
            .catch(err => console.error(err))

    },

    _postLogin(email, code) {
        const options = {
            method: "POST",
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify({ email, code })
        }
        return fetch(`http://127.0.0.1:5000/api/subscriptions/login`, options);
    },

    _getSubscriptions (page=1, size=this.size) {
        if (page == 0) page = 1;
        return fetch(`http://127.0.0.1:5000/api/subscriptions?page=${page}&size=${size}`).then(res => res.json())
    },

    _getSubscriptionById (id) {
        if (!id) return console.log("There is not ID");
        return fetch(`http://127.0.0.1:5000/api/subscriptions/${id}`).then(res => res.json())
    },

    _patchSubscriptions(subscription) {
        if(!subscription) return console.error("There is not subscription to update");
    
        const options = {
            method: "PATCH",
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(subscription)
        }
        return fetch(`http://127.0.0.1:5000/api/subscriptions/${subscription.id}`, options).then(res => res.json())
    },

    _getProductInfoBySku (skuId) {
        if (!skuId) return;
        return fetch(`http://127.0.0.1:5000/api/catalog/${skuId}`).then(res => {
            console.log(res)
            if (res.status == 404) {
                throw "Not found: " + skuId
            } else {
                return res.json()
            }
        });
    },

    getSubscriptions (page=1, size=this.size) {
        this.page = page;

        this._getSubscriptions(page, size)
            .then(subscriptions => this.subscriptions = subscriptions)
            .then(subscriptions => this.updateRenderSubscriptions(subscriptions))
            .then(() => this.renderPagination(page, page + 5))
            .catch(err => console.error(err));
    },

    launchConfirmationModal(subscriptionId, elementId, action="CANCELED") {
        this._getSubscriptionById(subscriptionId)
            .then(subscription => {
                let updateSubscription = subscription;
                updateSubscription.status = action;
                return updateSubscription;
            })
            .then(subscription => {
                this.subscription = subscription;
                this.elementId = elementId;
                this.renderConfirmationModal(subscription, elementId);
            })
            .catch(err => {
                console.error(err);
                M.toast({html: 'Hubo un error, intenta más tarde!'});
                $(".modal").modal("close");
            })
    },

    renderConfirmationModal(subscription, elementId="subscription-cancel-confirmation" ) {
        if (!subscription) return;
        $("#"+elementId+" .progress").hide();
        $("#"+ this.elementId).removeClass("loading");
        $("#"+ this.elementId).find(".modal-footer button").each(function () { $(this).removeClass("disabled")});
        
        const { customerEmail } = subscription;
        $("#"+ elementId +" span.email-usuario").text(customerEmail);
        $("#"+ elementId +" button.confirm-delete-suscription").attr("data-email", customerEmail );
    },

    confirmUpdateSubscription() {
        if (!this.subscription || Object.keys(this.subscription).length == 0) return console.log("There is not subscription to update.");
        
        $("#"+ this.elementId).addClass("loading");
        $("#"+ this.elementId).find(".modal-footer button").each(function () { $(this).addClass("disabled")});
        $("#"+ this.elementId).find(".progress").show();

        this._patchSubscriptions(this.subscription)
            .then(() => {
                this.getSubscriptions();
                M.toast(
                    {
                        html: 'Suscripción actualizada, en breve se actualizará el UI!',
                        completeCallback: () => $(".modal").modal("close")
                    });
            })
            .catch(err => {
                console.error(err);
                M.toast({html: 'Hubo un error, intenta más tarde!'});
                $(".modal").modal("close");
            });
    },

    launchProductModal(skuId) {
        this._getProductInfoBySku(skuId)
            .then(product => this.renderProductModal(product))
            .catch(err => {
                console.error(err);
                M.toast({html: 'Sku no encontrado!'});
                $(".modal").modal("close");
            });
    },

    renderProductModal(product) {
        $("#product-detail-modal .progress").remove();

        $("#product-detail-modal .modal-content h4.title-modal").text(product.Name);
        $("#product-detail-modal .modal-content p.description-modal").text(product.Description);
        
        const _layoutTBody = `<tr>
            <td>${product.Id}</td>
            <td>${product.BrandId}</td>
            <td>${product.CategoryId}</td>
            <td>${product.DepartmentId}</td>
            <td>${product.IsActive ? "Activo" : "Desactivado" }</td>
        </tr>`;
        $("#product-detail-modal .modal-content table tbody").html(_layoutTBody);
        $("#product-detail-modal .modal-footer a.go-to-product").attr("href", "https://www.puppis.com.co/" + product.LinkId + "/p");
    },

    updateRenderSubscriptions (subscriptions) {
        if (!subscriptions || subscriptions.length == 0) return this.renderEmptySubscriptions();
        let _layoutSubscriptions = "";

        subscriptions.map(subscription => {
            let _layoutItems = "";
            subscription.items.map(item => _layoutItems += `<li class="item ${item.status} hoverable modal-trigger" data-target="product-detail-modal" data-sku="${item.skuId}">${item.skuId}</li>`)
            
            const _layout = `
                <li class="collection-item row" data-id="${subscription.id}">
                    <div class="col s3 email">
                        ${subscription.customerEmail}
                    </div>
                    <div class="col s2 last-purchase">
                        ${new Date(subscription.lastPurchaseDate).toLocaleDateString()}
                    </div>
                    <div class="col s2 next-purchase">
                        ${new Date(subscription.nextPurchaseDate).toLocaleDateString()}
                    </div>
                    <ul class="col s2 items">
                        ${_layoutItems}
                    </ul>
                    <div class="col s1 status">
                        <span class="${subscription.status}">${subscription.status}</span>
                    </div>
                    <div class="col s2">
                        <a id="${subscription.id}" data-target="${subscription.status == "ACTIVE" ? "subscription-cancel-confirmation" : "subscription-activate-confirmation"}" class="waves-effect waves-light btn modal-trigger ${subscription.status == "ACTIVE" ? "cancel-subscription red" : "activate-subscription green"}">${subscription.status == "ACTIVE" ? "Cancelar" : "Activar"}</a>
                    </div>
                </li>
            `;

            _layoutSubscriptions += _layout;
        });

        $(".subscriptions-list").html(_layoutSubscriptions);
    },

    renderLoadingSubscriptions () {
        const _loadingLayoyt = `<div class="progress yellow lighten-5"><div class="indeterminate yellow darken-2"></div></div>`;
        $(".subscriptions-list").html(_loadingLayoyt);
    },

    renderEmptySubscriptions () {
        
        const _layoutEmpty = `
            
                <div class="col s12 m5" style="margin:auto;float:none;">
                    <div class="card-panel blue-grey lighten-3">
                        <div class="row" style="display:flex;justify-content:center;">
                            <i class="large material-icons white-text">new_releases</i>
                        </div>
                        <div class="row">
                            <span style="display:block;margin:auto;text-align:center;" class="white-text">
                                No hay suscripciones para mostrar
                            </span>
                        </div>
                    </div>
                </div>
            
        `;

        $(".subscriptions-list").html(_layoutEmpty);
    },

    renderPagination (from=1, to=5) {
        
        let _paginationLayout = "";
        _paginationLayout += `<li><button class="waves-effect waves-light btn-small prev-page yellow darken-2 ${from <= 1 ? "disabled" : ""}"><i class="material-icons">chevron_left</i></button></li>`;
        
        for (let i=from;i<(to);i++) {
            _paginationLayout += `<li><button class="waves-effect waves-light btn-small btn-small btn-page yellow darken-2" data-page="${i}">${i}</button></li>`;
        }
        
        if (this.subscriptions.length > 0) {
            _paginationLayout += `<li><button class="waves-effect waves-light btn-small btn-small next-page yellow darken-2"><i class="material-icons">chevron_right</i></button></li>`;
        }

        $(".pagination").html(_paginationLayout);
    },

    filterByStatus(context,status) {
        
        $("ul.menu-subscriptions li").each(function () { 
            $(this).removeClass("active");
            $(this).find("button").removeClass("yellow darken-2");
            $(this).find("button").addClass("btn-flat");
         });
        
        setTimeout(() => {
            $(context).closest("li").addClass("active");
            $(context).addClass("yellow darken-2");
            $(context).removeClass("btn-flat");
            $(context).addClass("btn");

            if (status == "") {
                this.updateRenderSubscriptions(this.subscriptions);
            } else {
                this.updateRenderSubscriptions(this.subscriptions.filter(subscription => subscription.status == status))
            }

        }, 30);
        
    },
}

$(document).ready(function () {
    Subscriptions.init();
});

