let mapIframe = null;
let mapContainer = null;

window.onload = function() {

  async function init() {
    await showPlaceNamesToMap();
  }

  init();

  // 選択した場所の名前をリストに追加
  document.addEventListener('mouseup', (event) => {
    if (event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' || 
        event.target.isContentEditable) {
      return;
    }

    let selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0) {
      if (confirm(selectedText + ": この場所を追加しますか？")) {
        addPlaceNameToList(selectedText);
        addPlaceNameToMap(selectedText); // should check if already exist
      }
    }

    window.getSelection().removeAllRanges();
    selectedText = "";
  });

  window.addEventListener("message", async (event) => {
    const data = event.data;
    if (data.type === "geocodeError") {
      alert(data.placeName + ": 検索結果が出てきませんでした。住所または別の単語で検索してください。")
      await deleteFromPlaceNameList(data.placeName);
    } else if (data.type === "markerDeleted") {
      console.log(data.placeName + "が削除されました")
      await deleteFromPlaceNameList(data.placeName);
    }
  });

  // 場所の名前ををリストから削除
  async function deleteFromPlaceNameList(placeName) {
    let result = await chrome.storage.local.get(["placeNames"]);
    let placeNames = result.placeNames || [];

    placeNames = placeNames.filter(addr => addr !== placeName);

    // 更新した配列をchrome storageに保存
    chrome.storage.local.set({ placeNames: placeNames }, () => {
      console.log(`delete ${placeName} saved to storage`);
    });
  }

  async function addPlaceNameToList(placeName) {
    // 既存の住所リストを取得（なければ空配列）
    const result = await chrome.storage.local.get(["placeNames"]);
    const placeNames = result.placeNames || [];

    // 配列にaddressが含まれているかチェック
    if (!placeNames.includes(placeName)) {
      placeNames.push(placeName);

      chrome.storage.local.set({ placeNames: placeNames }, () => {
        console.log(`add ${placeName} saved to storage`);
      });
    }
  }

  // 新しい場所をMapに追加
  async function addPlaceNameToMap(placeName) {
    mapIframe.contentWindow.postMessage({ type: "ADD_PLACE", placeName: placeName}, '*');
  }

  // リストにある場所をMapに表示
  async function showPlaceNamesToMap() {
    mapContainer = document.createElement('div');
    try {
      mapContainer.style.position = 'fixed';
      mapContainer.style.right = '0px';
      mapContainer.style.top = '0px';
      mapContainer.style.width = '300px';
      mapContainer.style.height = '250px';
      mapContainer.style.zIndex = '9999';
      mapContainer.style.border = '1px solid #ccc';
      mapContainer.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
      mapContainer.style.resize = 'both';
      mapContainer.style.overflow = 'auto';
      mapContainer.id = 'mapContainer';
      mapContainer.style.backgroundColor = "white";

      makeResizableLeftBottom(mapContainer);
      makeDraggable(mapContainer);

      // Map iframe作成
      mapIframe = document.createElement('iframe');

      mapIframe.src = "https://mikimiki.site";
      mapIframe.width = "92%";
      mapIframe.height = "92%";
      mapIframe.style.marginTop = "4%"
      mapIframe.style.marginBottom = "4%"
      mapIframe.style.marginLeft = "4%"
      mapIframe.style.marginRight = "4%"
      mapIframe.style.border = "0";

      // deleteボタン作成
      const deleteMapButton = document.createElement('button');
      deleteMapButton.textContent = "x";
      deleteMapButton.style.position = 'absolute';
      deleteMapButton.style.top = '5px';
      deleteMapButton.style.right = '5px';
      deleteMapButton.style.background = 'black';
      deleteMapButton.style.color = 'white';
      deleteMapButton.style.border = 'none';
      deleteMapButton.style.padding = '5px 10px';
      deleteMapButton.style.cursor = 'pointer';
      deleteMapButton.addEventListener('click', function() {
        mapContainer.remove();
        chrome.storage.local.set({ placeNames: [] })
      });

      // 縮小ボタン作成
      const shrinkMapButton = document.createElement('button');
      shrinkMapButton.textContent = "-";
      shrinkMapButton.style.position = 'absolute';
      shrinkMapButton.style.top = '5px';
      shrinkMapButton.style.right = '40px';
      shrinkMapButton.style.background = 'black';
      shrinkMapButton.style.color = 'white';
      shrinkMapButton.style.border = 'none';
      shrinkMapButton.style.padding = '5px 10px';
      shrinkMapButton.style.cursor = 'pointer';

      // しおり作るボタン
      const shioriButton = document.createElement('button');
      shioriButton.textContent = "しおりを作る";
      shioriButton.style.color = "black";
      shioriButton.style.position = 'absolute';
      shioriButton.style.bottom = '0px';
      shioriButton.style.right = '0px';
      shioriButton.style.backgroundColor = "yellow";
      shioriButton.style.border = 'none';
      shioriButton.style.padding = '5px 10px';
      shioriButton.style.cursor = 'pointer';

      // 「地図の表示」ボタン作成
      const showMapIcon = document.createElement('div');

      showMapIcon.style.position = 'fixed';
      showMapIcon.style.top = '5px';
      showMapIcon.style.right = '20px';
      showMapIcon.style.width = '50px';
      showMapIcon.style.height = '20px';
      showMapIcon.style.background = 'white';
      showMapIcon.style.border = '1px solid black';
      showMapIcon.style.cursor = 'pointer';
      showMapIcon.style.display = 'none'; // 最初は非表示
      showMapIcon.textContent = "Map"
      showMapIcon.style.textAlign = "center";

      // 縮小ボタンクリック時の処理
      shrinkMapButton.addEventListener('click', function() {
        // mapContainerの地図表示部分を非表示にする
        mapContainer.style.display = 'none';

        // 「地図の表示」ボタンを表示
        showMapIcon.style.display = 'block';
      });

      // 「地図の表示」ボタンのクリックで元に戻す
      showMapIcon.addEventListener('click', function() {
        mapContainer.style.display = 'block';
        showMapIcon.style.display = 'none';
      });

      // しおりボタンクリック時の処理
      shioriButton.addEventListener('click', async function() {
        const result = await chrome.storage.local.get(["placeNames"]);
        const placeNames = result.placeNames || [];

        const query = encodeURIComponent(JSON.stringify(placeNames));
        window.top.location.href = `http://mikimiki.site/shiori/?placeNames=${query}`;
      });

      // コンテナに追加
      mapContainer.appendChild(mapIframe);
      mapContainer.appendChild(shrinkMapButton);
      mapContainer.appendChild(shioriButton);
      mapContainer.appendChild(deleteMapButton);
      document.body.appendChild(showMapIcon);
      document.body.appendChild(mapContainer);

      // 地図に全ての場所を表示
      mapIframe.onload = async () => {
        let result = await chrome.storage.local.get(["placeNames"]);
        const placeNames = result.placeNames || [];
        mapIframe.contentWindow.postMessage({ type: "SHOW_ALL_PLACES", placeNames: placeNames}, '*');
      };
    } catch (error) {
      console.error("Error loading map:", error);
      mapContainer.innerText = "Something went wrong."
    }
  }

  function makeDraggable(element) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;

    element.style.transform = "translate(0px, 0px)";
    element.style.cursor = "grab";

    element.addEventListener("mousedown", (e) => {
      // ドラッグ対象外
      if (
        e.target.tagName === "BUTTON" ||
        e.target.tagName === "IFRAME" ||
        e.target.style.cursor === "nwse-resize" // リサイズハンドルを無視
      ) return;

      isDragging = true;
      startX = e.clientX - currentX;
      startY = e.clientY - currentY;
      element.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      currentX = e.clientX - startX;
      currentY = e.clientY - startY;

      element.style.transform = `translate(${currentX}px, ${currentY}px)`;
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      element.style.cursor = "grab";
    });
  }

  function makeResizableLeftBottom(element) {
    const handle = document.createElement('div');
    handle.style.position = 'absolute';
    handle.style.left = '0';
    handle.style.bottom = '0';
    handle.style.width = '30px';
    handle.style.height = '30px';
    handle.style.background = 'rgba(0,0,0,0.5)';
    handle.style.cursor = 'nwse-resize';
    handle.style.zIndex = '10000';

    element.style.position = 'fixed';
    element.appendChild(handle);

    let startX, startY, startWidth, startHeight;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      startX = e.clientX;
      startY = e.clientY;
      startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);
      startHeight = parseInt(document.defaultView.getComputedStyle(element).height, 10);

      function doDrag(e) {
        const dx = startX - e.clientX; // 横方向の増減
        const dy = e.clientY - startY; // 縦方向の増減

        element.style.width = (startWidth + dx) + 'px';
        element.style.height = (startHeight + dy) + 'px';
      }

      function stopDrag() {
        document.documentElement.removeEventListener('mousemove', doDrag, false);
        document.documentElement.removeEventListener('mouseup', stopDrag, false);
      }

      document.documentElement.addEventListener('mousemove', doDrag, false);
      document.documentElement.addEventListener('mouseup', stopDrag, false);
    });
  }

};