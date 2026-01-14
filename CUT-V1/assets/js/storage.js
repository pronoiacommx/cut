const LS_AVATAR_KEY = "control_escolar_avatar";

export function loadAvatar(defaultDataUrl){
  return localStorage.getItem(LS_AVATAR_KEY) || defaultDataUrl;
}

export function saveAvatar(dataUrl){
  localStorage.setItem(LS_AVATAR_KEY, dataUrl);
}

export function clearAvatar(){
  localStorage.removeItem(LS_AVATAR_KEY);
}

export function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
