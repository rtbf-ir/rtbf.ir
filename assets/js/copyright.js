function toPersianNumber(number) {
  const numbersMap = {
    0: "۰",
    1: "۱",
    2: "۲",
    3: "۳",
    4: "۴",
    5: "۵",
    6: "۶",
    7: "۷",
    8: "۸",
    9: "۹",
  };
  return String(number)
    .split("")
    .map((digit) => numbersMap[digit] || digit)
    .join("");
}

document.getElementById("copyrightyear").innerHTML =
  toPersianNumber(new Date().getFullYear()) + " - ۲۰۲۱";
