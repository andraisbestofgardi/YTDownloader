let format="mp3"

function changeType(type,element){

format=type

document
.querySelectorAll(
".card"
)

.forEach(

v=>v
.classList
.remove(
"active"
)

)

element
.classList
.add(
"active"
)

}

function downloadVideo(){

const url=

document
.getElementById(
"url"
)
.value

if(!url){

alert(
"Masukkan URL YouTube"
)

return

}

const result=

document
.getElementById(
"result"
)

result
.style
.display=
"block"

document
.getElementById(
"info"
)

.innerHTML=

`
URL:
<br><br>

${url}

<br><br>

Format:
${format.toUpperCase()}

`

}