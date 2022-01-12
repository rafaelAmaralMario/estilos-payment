function getAmount(amount) {
    let value = "";
    for(let i = 0; i < amount.length; i++) {
        if(value > 1) {
            value =`${value}${amount[i]}`
        } else if(amount[i] > 0) {
            value = amount[i]
        }
    }

    return value.slice(0, -2);
}


module.exports = {
    getAmount
 };
 