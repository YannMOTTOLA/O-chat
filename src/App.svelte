<script>
    import { onMount } from "svelte";
    import Markdown from "svelte-exmarkdown";
    import "./github-markdown.css";

    // États principaux de l'application (utilisation de $state pour la réactivité)
    let userInput = $state("");
    let promptTitle = $state(
        "Nouvelle Conversation, entrez un premier message",
    );
    let messages = $state([]);
    let showSidebar = $state(false);
    let selectedChat = $state(null);
    let chatList = $state([]);
    let isLoading = $state(false);
    let currentIAMessage = $state("");

    const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;
    const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

    let messageContainer; // Référence au conteneur de messages pour le scroll

    // Fait défiler la vue vers le bas pour afficher le dernier message
    function scrollToBottom() {
        if (messageContainer) {
            setTimeout(() => {
                messageContainer.scrollTop = messageContainer.scrollHeight;
            }, 0);
        }
    }

    // Gestion de l'envoi du formulaire utilisateur
    async function handleSubmit(event) {
        event.preventDefault();
        const trimmed = userInput.trim();
        if (!trimmed) return;

        // Si aucune conversation sélectionnée, on crée une nouvelle
        if (!selectedChat) {
            const title = await getTitleFromAI(trimmed);
            selectedChat = await addNewChat(title);
            if (!selectedChat) return;
        }

        try {
            // Sauvegarde du message utilisateur dans Pocketbase
            await saveIntoPocketbase({
                role: "user",
                content: trimmed,
                conversation_id: selectedChat.id,
            });
            userInput = "";
        } catch (error) {
            alert("Erreur lors de l'envoi du message : " + error.message);
            return;
        }

        isLoading = true;
        currentIAMessage = "";

        try {
            // Préparation des messages pour l'API Mistral
            const cleanedMessages = messages.map((m) => ({
                role: m.role,
                content: m.content,
            }));

            // Appel à l'API Mistral pour obtenir la réponse de l'IA
            const response = await fetch(
                "https://api.mistral.ai/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        Authorization: "Bearer " + apiKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "mistral-medium",
                        messages: cleanedMessages,
                    }),
                },
            );

            const chatResponse = await response.json();
            const iaMessage =
                chatResponse.choices?.[0]?.message?.content?.trim();

            isLoading = false;

            if (!iaMessage) {
                alert("L'IA n'a pas répondu.");
                return;
            }

            // Affichage progressif du message IA (effet "machine à écrire")
            const words = iaMessage.split(" ");
            for (let i = 0; i < words.length; i++) {
                currentIAMessage += (i > 0 ? " " : "") + words[i];
                scrollToBottom();
                await new Promise((resolve) => setTimeout(resolve, 40));
            }

            // Sauvegarde de la réponse IA dans Pocketbase
            await saveIntoPocketbase({
                role: "assistant",
                content: iaMessage,
                conversation_id: selectedChat.id,
            });

            currentIAMessage = "";
        } catch (error) {
            alert("Erreur lors de la réponse : " + error.message);
            isLoading = false;
        }
    }

    // Génère un titre court pour la conversation via l'IA
    async function getTitleFromAI(userPrompt) {
        try {
            const response = await fetch(
                "https://api.mistral.ai/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        Authorization: "Bearer " + apiKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "mistral-tiny-latest",
                        messages: [
                            {
                                role: "system",
                                content:
                                    "Tu es un assistant qui génère uniquement des titres de conversation, très courts et sans introduction. " +
                                    "Tu dois répondre par un **titre strictement composé de 5 mots maximum** (pas plus), **sans guillemets**" +
                                    "**sans ponctuation** et **sans reformulation**. " +
                                    "N'explique pas ta réponse. " +
                                    "Le titre doit résumer le sujet principal du message utilisateur. " +
                                    "Ta réponse doit être uniquement ce titre. Exemple : 'Optimisation IA logistique PME'.",
                            },
                            {
                                role: "user",
                                content: userPrompt,
                            },
                        ],
                    }),
                },
            );

            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || "Sans titre";
        } catch (error) {
            alert("Erreur lors de la génération du titre :" + error.message);
            return "Sans titre";
        }
    }

    // Sauvegarde un message dans Pocketbase et l'ajoute à la liste locale
    async function saveIntoPocketbase(object) {
        try {
            const response = await fetch(
                `${POCKETBASE_URL}/api/collections/messageOchat/records`,
                {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify(object),
                },
            );
            const data = await response.json();
            messages.push(data);
            scrollToBottom();
            return data;
        } catch (error) {
            alert(
                "Erreur lors de la sauvegarde des données : " + error.message,
            );
        }
    }

    // Récupère les messages et les conversations au démarrage
    async function getData() {
        try {
            const messagesResponse = await fetch(
                `${POCKETBASE_URL}/api/collections/messageOchat/records`,
            );
            const messagesData = await messagesResponse.json();
            messages = messagesData.items;

            const chatsResponse = await fetch(
                `${POCKETBASE_URL}/api/collections/conversationsOchat/records`,
            );
            const chatsData = await chatsResponse.json();
            chatList = chatsData.items;
            messages = [];
        } catch (error) {
            alert(
                "Erreur lors de la récupération des données : " + error.message,
            );
        }
    }

    // Permet d'envoyer le message avec Entrée (sans Shift)
    function EnterKeyDown(event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
        }
    }

    function toggleSidebar() {
        showSidebar = !showSidebar;
    }

    // Crée une nouvelle conversation et la sélectionne
    async function addNewChat(chatTitle) {
        const trimmed = chatTitle.trim();
        if (!trimmed) return null;

        try {
            const response = await fetch(
                `${POCKETBASE_URL}/api/collections/conversationsOchat/records`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ title: trimmed }),
                },
            );

            const newChat = await response.json();
            selectedChat = newChat;
            chatList = [...chatList, newChat];
            promptTitle = newChat.title;
            messages = [];
            return newChat;
        } catch (error) {
            alert("Erreur lors de la création du chat : " + error.message);
        }
    }

    // Sélectionne une conversation existante et charge ses messages
    async function selectChat(chatCible) {
        selectedChat = chatCible;
        promptTitle = chatCible.title;

        const response = await fetch(
            `${POCKETBASE_URL}/api/collections/messageOchat/records?filter=conversation_id='${chatCible.id}'`,
        );
        const data = await response.json();
        messages = data.items;
        scrollToBottom();
    }

    // Réinitialise l'état pour démarrer une nouvelle conversation
    function startNewChat() {
        selectedChat = null;
        messages = [];
        promptTitle = "Nouvelle Conversation, entrez un premier message";
    }

    // Supprime une conversation et réinitialise si elle était sélectionnée
    async function deleteChat(chatId) {
        try {
            await fetch(
                `${POCKETBASE_URL}/api/collections/conversationsOchat/records/${chatId}`,
                { method: "DELETE" },
            );

            chatList = chatList.filter((chat) => chat.id !== chatId);

            if (selectedChat?.id === chatId) {
                selectedChat = null;
                messages = [];
                promptTitle =
                    "Nouvelle Conversation, entrez un premier message";
            }
        } catch (error) {
            alert("Erreur lors de la suppression du chat : " + error.message);
        }
    }

    // Appel initial pour charger les données à l'ouverture de l'app
    onMount(getData);
</script>

<div class="body__container">
    {#if showSidebar}
        <div class="overlay" role="presentation" onclick={toggleSidebar}></div>
    {/if}

    <header class="header {showSidebar ? 'visible' : 'hidden'}">
        <img src="/O-chat/logo/logo.png" alt="logo O'chat" class="logo" />
        <div class="header-chatSelection">
            <button class="button input-new-chat" onclick={startNewChat}
                >Nouveau chat</button
            >
            <div class="chatSelection__selectChat">
                {#each chatList as chat (chat.id)}
                    <div class="selectPrompt">
                        <button
                            type="button"
                            class="button selectChat-btn {promptTitle ===
                            chat.title
                                ? 'conv-selected'
                                : ''}"
                            onclick={() => selectChat(chat)}
                        >
                            <span>{chat.title}</span>
                        </button>
                        <button
                            class="deleteChat-btn"
                            onclick={() => deleteChat(chat.id)}
                            aria-label="Supprimer le chat"
                        >
                            <img
                                src="/O-chat/logo/supprimer.png"
                                alt=""
                                class="icon"
                            />
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    </header>

    <main class="main">
        <button
            class="toggle-sidebar-btn"
            onclick={toggleSidebar}
            aria-label="Ouvrir le menu"
        >
            ☰
        </button>

        <div class="main__promptTitle">
            <h1 id="chat-title">{promptTitle}</h1>
            {#if promptTitle}
                <hr class="title__separator" />
            {/if}
        </div>

        <div class="main__promptContent" bind:this={messageContainer}>
            {#each messages as msg}
                <div
                    class={msg.role === "user"
                        ? "promptContent__user"
                        : "promptContent__ia"}
                >
                    {#if msg.role === "assistant"}
                        <hr class="ia__separator" />
                        <h2>O'chat</h2>
                        <div class="promptContent__ia-text markdown-body">
                            <Markdown md={msg.content} />
                        </div>
                    {:else}
                        <h2>{msg.role}</h2>
                        <div
                            class="promptContent__user-text markdown-body text"
                        >
                            <Markdown md={msg.content} />
                        </div>
                    {/if}
                    <h3 class="date">
                        {new Date(msg.created).toLocaleString()}
                    </h3>
                </div>
            {/each}
            {#if isLoading && !currentIAMessage}
                <div class="promptContent__ia loading">
                    <h2>O'chat</h2>
                    <div class="promptContent__ia-text">
                        <img
                            src="/O-chat/logo/favicon.png"
                            alt="Chargement..."
                            class="loading-icon"
                        />
                        <em>O'chat réfléchit...</em>
                    </div>
                </div>
            {/if}

            {#if currentIAMessage}
                <div class="promptContent__ia">
                    <h2>O'chat</h2>
                    <div class="promptContent__ia-text markdown-body">
                        <Markdown md={currentIAMessage} />
                    </div>
                </div>
            {/if}
        </div>

        <div class="main__userPromptWritingArea">
            <form class="userPromptWritingArea__form" onsubmit={handleSubmit}>
                <textarea
                    bind:value={userInput}
                    class="form__userPrompt"
                    placeholder="Posez une question"
                    onkeydown={EnterKeyDown}
                ></textarea>
                <button type="submit" class="submit-btn submit">✔</button>
            </form>
        </div>
    </main>
</div>

<style>
    .body__container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        box-sizing: border-box;
    }

    .header {
        position: fixed;
        z-index: 2;
        width: 75vw;
        max-width: 280px;
        height: 100vh;
        background-color: #888888;
        transform: translateX(-100%);
        transition: transform 0.3s ease-in-out;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1rem 0;
        box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
    }

    .header.visible {
        transform: translateX(0);
    }

    .logo {
        width: 108px;
        height: auto;
        margin-bottom: 1rem;
        display: block;
        margin-left: auto;
        margin-right: auto;
    }

    .header-chatSelection {
        display: flex;
        flex-direction: column;
        background-color: transparent;
        width: 100%;
        padding: 0;
        margin-top: 1rem;
    }

    .input-new-chat {
        width: 90%;
        margin: 0 auto 1rem auto;
        padding: 0.5rem;
        border-radius: 0.5rem;
        border: none;
        font-size: 0.8rem;
        box-sizing: border-box;
    }

    .selectChat-btn,
    .submit-btn {
        background-color: #b3aeae;
    }

    .button {
        width: 90%;
        padding: 0.5rem;
        border-radius: 0.5rem;
        font-size: 0.8rem;
        box-sizing: border-box;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: none;
        outline: none;
    }

    .input-new-chat {
        width: 90%;
        padding: 0.5rem;
        border-radius: 0.5rem;
        font-size: 0.8rem;
        box-sizing: border-box;
        border: none;
        outline: none;
    }

    .button:hover {
        background-color: #707070;
    }

    .chatSelection__selectChat {
        background-color: transparent;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0 1rem;
    }

    button.conv-selected {
        background-color: #707070;
    }

    .selectChat-btn {
        background-color: #eeeeee;
        color: #222;
        border: none;
        border-radius: 0.5rem;
        padding: 0.5rem;
        width: 100%;
        text-align: left;
    }

    .selectPrompt {
        position: relative;
        display: flex;
    }

    .icon {
        width: 1rem;
        height: 1rem;
    }

    .loading-icon {
        width: 20px;
        height: 20px;
        margin-right: 0.5rem;
        vertical-align: middle;
        animation: spin 2s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .main {
        flex: 1;
        background-color: #d9d9d9;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 1rem;
        border-radius: 0;
        margin: 0;
        box-sizing: border-box;
        height: 100vh;
        overflow: hidden;
        position: relative;
    }

    .main__promptTitle {
        background-color: transparent;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
    }

    #chat-title {
        font-size: 1.5rem;
        font-weight: bold;
        margin: 0;
    }

    .title__separator {
        display: none;
    }

    .main__promptContent {
        flex: 1;
        overflow-y: auto;
        padding: 0 1rem;
    }

    .promptContent__user {
        margin-left: 30%;
    }

    .date {
        margin-top: -1rem;
        font-size: 0.8rem;
        padding-left: 0.6rem;
    }

    h2 {
        font-size: 0.7rem;
        padding-left: 0.6rem;
        margin-bottom: 0rem;
    }

    .text {
        white-space: pre-line;
    }

    .promptContent__user-text,
    .promptContent__ia-text {
        background-color: #717070;
        padding: 1rem;
        border-radius: 1rem;
        font-size: 0.7rem;
        font-weight: bold;
        margin-bottom: 1rem;
        color: white;
    }

    .promptContent__ia.loading .promptContent__ia-text {
        font-style: italic;
        opacity: 0.7;
    }

    .ia__separator {
        background-color: rgb(192, 192, 192);
        border: none;
        height: 2px;
    }

    .main__userPromptWritingArea {
        padding-top: 0.5rem;
        margin-bottom: 0.8rem;
    }

    .userPromptWritingArea__form {
        display: flex;
        position: relative;
        width: 100%;
    }

    .form__userPrompt {
        width: 100%;
        height: 3rem;
        border-radius: 0.5rem;
        border: none;
        padding: 0.5rem;
        font-size: 0.9rem;
        resize: none;
        box-sizing: border-box;
        outline: none;
    }

    .submit-btn,
    .deleteChat-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        position: absolute;
        right: 0.2rem;
        bottom: 8px;
        background: none;
        border: none;
        cursor: pointer;
    }

    .submit {
        width: 2rem;
        aspect-ratio: 1 / 1;
        padding: 1rem;
        background-color: #cfcfcf;
        border-radius: 2rem;
    }

    .toggle-sidebar-btn {
        box-sizing: border-box;
        position: absolute;
        top: 1rem;
        left: 1rem;
        background: transparent;
        color: white;
        font-size: 2rem;
        border: none;
        z-index: 3;
        cursor: pointer;
    }

    .overlay {
        position: fixed;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.3);
        z-index: 1;
    }

    @media (min-width: 810px) {
        .body__container {
            flex-direction: row;
        }

        .header {
            max-height: 95vh;
            position: relative;
            transform: none;
            width: 15vw;
            background-color: #383838;
            box-shadow: none;
        }

        .main {
            width: 85vw;
            padding: 1rem;
            height: 100vh;
        }

        .toggle-sidebar-btn {
            display: none;
        }

        .main__promptTitle {
            align-items: baseline;
        }

        #chat-title {
            font-size: 2.8rem;
        }

        .title__separator {
            display: block;
            height: 1px;
            background-color: #717070;
            border: none;
            width: 100%;
            margin-top: 0.2rem;
        }

        .main__promptContent {
            padding-right: 0.5rem;
        }

        .ia__separator {
            display: none;
        }
    }
</style>
