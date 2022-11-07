const Subscriptions = {
    subscriptions : null,
    page: 1,
    size: 10,

    init () {
        console.log("-- Subscriptions --");
        this.getSubscriptions();
        this.events();
    },

    events () {
        $(document)
            .on("click", ".nofilter", () => this.updateRenderSubscriptions(this.subscriptions))
            .on("click", ".filter-by-active", () => this.updateRenderSubscriptions(this.subscriptions.filter(subscription => subscription.status == "ACTIVE")))
            .on("click", ".filter-by-paused", () => this.updateRenderSubscriptions(this.subscriptions.filter(subscription => subscription.status == "PAUSED")))
            .on("click", ".filter-by-canceled", () => this.updateRenderSubscriptions(this.subscriptions.filter(subscription => subscription.status == "CANCELED")))
            .on("click", ".btn-page", function () {
                const newPage = parseInt($(this).attr("data-page"));
                Subscriptions.getSubscriptions(newPage, this.size);
            })
            .on("click", ".prev-page", () => this.getSubscriptions(Math.abs(this.page - 1), this.size))
            .on("click", ".next-page", () => this.getSubscriptions(this.page + 1, this.size))
            
    },

    getSubscriptions (page=1, size=this.size) {
        if (page == 0) page = 1;
        this.page = page;
        fetch(`http://127.0.0.1:5000/api/subscriptions?page=${page}&size=${size}`)
            .then(res => res.json())
            .then(subscriptions => this.subscriptions = subscriptions)
            .then(subscriptions => this.updateRenderSubscriptions(subscriptions))
            .then(() => this.renderPagination(page, page + 5))
            .catch(err => console.error(err));
    },

    updateRenderSubscriptions (subscriptions) {
        if (!subscriptions || subscriptions.length == 0) return this.renderEmptySubscriptions();
        let _layoutSubscriptions = "";

        subscriptions.map(subscription => {
            let _layoutItems = "";
            subscription.items.map(item => _layoutItems += `<li class="item ${item.status}" data-sku="${item.skuId}">${item.skuId}</li>`)
            
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
                    <div class="col s1">
                        <span>${subscription.status}</span>
                    </div>
                    <div class="col s2">
                        <a class="waves-effect waves-light btn ${subscription.status == "ACTIVE" ? "red" : ""}">${subscription.status == "ACTIVE" ? "Cancelar" : "Activar"}</a>
                    </div>
                </li>
            `;

            _layoutSubscriptions += _layout;
        });

        $(".subscriptions-list").html(_layoutSubscriptions);
    },

    renderEmptySubscriptions () {
        console.log("There are not subscriptions to show.");

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

        $(".subscriptions-list").html(_layoutEmpty)
    },

    renderPagination (from=1, to=5) {

        let _paginationLayout = "";
        _paginationLayout += `<li class="disabled"><button class="btn-small prev-page"><i class="material-icons">chevron_left</i></button></li>`;
        for (let i=from;i<(to);i++) {
            _paginationLayout += `<li class="waves-effect waves-light"><button class="btn-small btn-page" data-page="${i}">${i}</button></li>`;
        }
        _paginationLayout += `<li class="disabled"><button class="btn-small next-page"><i class="material-icons">chevron_right</i></button></li>`;

        $(".pagination").html(_paginationLayout);
    },
}

$(document).ready(function () {
    Subscriptions.init();
});

