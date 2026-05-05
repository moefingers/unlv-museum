function checkStockColor(stock){
    if(stock === "GME"){
        return 'rgba(61, 161, 61, 0.7)'
    }
    if(stock === "MSFT"){
        return 'rgba(209, 4, 25, 0.7)'
    }
    if(stock === "DIS"){
        return 'rgba(18, 4, 209, 0.7)'
    }
    if(stock === "BNTX"){
        return 'rgba(166, 43, 158, 0.7)'
    }
}

async function main() {


    const timeChartCanvas = document.querySelector('#time-chart');
    const highestPriceChartCanvas = document.querySelector('#highest-price-chart');
    const averagePriceChartCanvas = document.querySelector('#average-price-chart');


    // get data
    let data = mockData

    const { GME, MSFT, DIS, BNTX } = data;

    const stocks = [GME, MSFT, DIS, BNTX]

    // console.log(stocks)

    // console.log(Chart)


    stocks.forEach( stock => stock.values.reverse())

    new Chart(timeChartCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: stocks[0].values.reverse().map(value => value.datetime),
            datasets: stocks.map(stock => ({
                label: stock.meta.symbol,
                data: stock.values.reverse().map(value => parseFloat(value.high)),
                backgroundColor: checkStockColor(stock.meta.symbol),
                borderColor: checkStockColor(stock.meta.symbol),
            }))
        }
    });
    
    new Chart(highestPriceChartCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: stocks.map(stock => stock.meta.symbol),
            datasets: [{
                label: 'Highest',
                backgroundColor: stocks.map(stock => (
                    checkStockColor(stock.meta.symbol)
                )),
                borderColor: stocks.map(stock => (
                    checkStockColor(stock.meta.symbol)
                )),
                data: stocks.map(stock => (
                    returnHighest(stock.values)
                ))
            }]
        }
    });

    new Chart(averagePriceChartCanvas.getContext('2d'), {
        type: 'pie',
        data: {
            labels: stocks.map(stock => stock.meta.symbol),
            datasets: [{
                label: 'Average',
                backgroundColor: stocks.map(stock => (
                    checkStockColor(stock.meta.symbol)
                )),
                borderColor: stocks.map(stock => (
                    checkStockColor(stock.meta.symbol)
                )),
                data: stocks.map(stock => (
                    average(stock.values)
                ))
            }]
        }
    });
}

function returnHighest(array) {
    let max = 0;
    array.forEach(value => {
        if (parseFloat(value.high) > max) {
            max = value.high
        }
    })
    return max
}

function average(array) {
    let total = 0;
    array.forEach(value => {
        total += parseFloat(value.high)
    })
    return (total / array.length)
}
    
    

main()