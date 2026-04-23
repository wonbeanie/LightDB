export function errorHandler(error : unknown, message = ""){
  let err = error instanceof Error ? error : 
            typeof error === "string" ? new Error(error) : new Error();

  if(message){
    err = new Error(`${message} ${err.message}`);
  }

  console.error(err.message);

  return err;
}

export function formatNow(): string {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}