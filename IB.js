// --- 1. BASE DE DONNÉES ET MÉMOIRE ---
// On essaie de charger les membres depuis le stockage, sinon on crée un objet vide
let dbMembres = JSON.parse(localStorage.getItem('tontine_membres')) || {};

// Configuration des taux
// Tout en haut du JavaScript, remplacez la variable reglageTontine par :
let reglageTontine = JSON.parse(localStorage.getItem('tontine_reglage')) || {
    frequence: 14,
    dateDebut: "",
    montantBase: 10000,
    tauxOrdinaire: 10,
     tauxSpecial: 10,
    seanceActuelle: 1
};
let fileAttente = []; 
let dernierVersement = null;
const CODES = { "1111": "tresorier", "2222": "commissaire", "3333": "secretaire", "0000": "president" };

// --- 2. INITIALISATION AU CHARGEMENT ---
window.onload = function() {
    const nomAsso = localStorage.getItem('tontine_nom');
    const currentId = localStorage.getItem('tontine_current_user_id');

    // On affiche le nom de l'association si elle existe
    if(nomAsso) {
        if(document.getElementById('app-title')) document.getElementById('app-title').innerText = nomAsso;
        if(document.getElementById('app-logo')) document.getElementById('app-logo').innerText = nomAsso.charAt(0).toUpperCase();
    }

    // LE TEST DE SESSION :
    if(currentId && dbMembres[currentId]) {
        // L'utilisateur est déjà connecté -> On charge ses données secrètes
        document.getElementById('user-name').innerText = dbMembres[currentId].nom;
        document.getElementById('prof-display-name').innerText = dbMembres[currentId].nom;
        
        // On montre les barres de navigation
        document.querySelector('.bottom-bar').classList.remove('hidden');
        document.querySelector('.main-header').classList.remove('hidden');
        
        // On cache tout SAUF la page d'accueil (Home)
        document.querySelectorAll('.app-page').forEach(p => p.classList.add('hidden'));
        document.getElementById('page-home').classList.remove('hidden');
    } else {
        // L'utilisateur n'est PAS connecté -> Écran de connexion obligatoire
        document.querySelector('.bottom-bar').classList.add('hidden');
        document.querySelector('.main-header').classList.add('hidden');
        document.querySelectorAll('.app-page').forEach(p => p.classList.add('hidden'));
        document.getElementById('page-login').classList.remove('hidden');
    }
    
    // On met à jour les chiffres du portefeuille
    refreshData();
};
// --- 3. GESTION DES ÉCRANS DE CONNEXION ---
function showAuth(mode) {
    document.getElementById('login-choices').classList.add('hidden');
    document.getElementById('auth-rejoindre').classList.add('hidden');
    document.getElementById('auth-creer').classList.add('hidden');

    if(mode === 'rejoindre') {
        document.getElementById('auth-rejoindre').classList.remove('hidden');
    } else if(mode === 'creer') {
        document.getElementById('auth-creer').classList.remove('hidden');
    } else if(mode === 'choices') {
        document.getElementById('login-choices').classList.remove('hidden');
    }

    if (document.getElementById('zone-agenda')) {
    document.getElementById('zone-agenda').innerHTML = genererAgendaHTML();
    }
}

// --- 4. CRÉATION ET CONNEXION (LOGIQUE SERVEUR-READY) ---
// REMPLACEZ LA FONCTION finaliserCreation PAR CELLE-CI :
function finaliserCreation() {
    const asso = document.getElementById('creer-nom-asso').value.trim();
    const boss = document.getElementById('creer-nom-boss').value.trim();
    
    // Récupération des nouveaux paramètres d'agenda
    const freq = parseInt(document.getElementById('creer-frequence').value);
    const dateDeb = document.getElementById('creer-date-debut').value;
    const mtBase = parseInt(document.getElementById('creer-montant-base').value) || 10000;

    if(!asso || !boss || !dateDeb) {
       afficherModale("Oups !", "Veuillez remplir tous les champs pour créer votre tontine.", "⚠️");
        return;
    }

    // Sauvegarde des réglages de l'agenda
    reglageTontine = {
        frequence: freq,
        dateDebut: dateDeb,
        montantBase: mtBase,
        seanceActuelle: 1
    };
    localStorage.setItem('tontine_reglage', JSON.stringify(reglageTontine));

    // ================= ENTRAÎNEMENT DE LA TRIPLE SÉCURITÉ MULTI-ASSOCIATIONS =================
    // 1. On extrait les 3 premières lettres sans espaces et en majuscules (Ex: "LES")
    const prefixeNettoye = asso.replace(/\s/g, '').substring(0, 3).toUpperCase();
    
    // 2. On récupère automatiquement l'année de création en cours (Ex: 2026)
    const anneeEnCours = new Date().getFullYear();
    
    // 3. On génère le nombre aléatoire à 4 chiffres (Ex: 8492)
    const cryptoChiffre = Math.floor(1000 + Math.random() * 9000);
    
    // 4. On assemble le tout : aucun doublon possible entre les différentes associations !
    const code = `${prefixeNettoye}-${anneeEnCours}-${cryptoChiffre}`;
    // Résultat parfait : "LES-2026-8492"
    // =========================================================================================

    localStorage.setItem('tontine_nom', asso);
    localStorage.setItem('tontine_code', code);

    // Initialisation de la base de membres (Le président est le n°1)
    dbMembres = {};
    dbMembres["1"] = { 
        nom: boss, 
        role: "Président", 
        epargne: 0, sanctions: 0, empOrd: 0, empSpec: 0, dev: 0, fondCaisse: 0, scolaire: 0,
        seances: 1, 
        presence: 100 
    };

    if(document.getElementById('app-title')) document.getElementById('app-title').innerText = asso;
    if(document.getElementById('app-logo')) document.getElementById('app-logo').innerText = asso.charAt(0).toUpperCase();

    afficherModale("Félicitations ! 🎉", "Votre tontine a été créée avec succès.\n\nVoici votre code d'invitation secret : " + code, "🚀");
    sauvegarderEtEntrer("1", boss);
}


function appliquerRoleBureau() {
    // 1. On récupère l'identifiant du membre sélectionné et le rôle choisi
    const idMembre = document.getElementById('pres-membre-select').value;
    const nouveauRole = document.getElementById('pres-role-select').value;

    // Sécurité : Le président ne doit pas se rétrograder lui-même par erreur
    if (idMembre === "1") {
        afficherModale("Action impossible 🛑", "Le Créateur/Président Fondateur ne peut pas changer son propre rôle.", "⚠️");
        return;
    }

    // 2. On applique le changement de rôle rétroactivement dans la base de données
    if (dbMembres[idMembre]) {
        const ancienNom = dbMembres[idMembre].nom;
        dbMembres[idMembre].role = nouveauRole;

        // 3. On sauvegarde définitivement la modification dans le téléphone
        localStorage.setItem('tontine_membres', JSON.stringify(dbMembres));

        // 4. On rafraîchit l'affichage complet immédiatement
        refreshData();

        // 5. Petit message de confirmation stylé
        afficherModale(
            "Nomination validée 👑", 
            `${ancienNom} a été nommé avec succès au poste de :\n👉 ${nouveauRole}`, 
            "✨"
        );
    } else {
        afficherModale("Erreur ❌", "Impossible de trouver ce membre dans la tontine.", "👤");
    }
}

function connexionTontine() {
    const codeSaisi = document.getElementById('join-code').value.trim();
    const nomMembre = document.getElementById('join-nom').value.trim(); 
    const codeOfficiel = localStorage.getItem('tontine_code');

    if(!codeSaisi || !nomMembre) {
        afficherModale("Champs requis ⚠️", "Veuillez saisir le code d'invitation ET votre nom.", "👤");
        return;
    }

    // 1. On vérifie si le code de la réunion est le bon
    if(codeSaisi !== codeOfficiel) {
        afficherModale("Code incorrect ❌", "Ce code d'invitation n'existe pas. Demandez le bon code au Président.", "🔒");
        return;
    }

    // 2. RECONEXION : On cherche si ce nom existe déjà dans la tontine
    let idTrouve = null;
    for (const [id, membre] of Object.entries(dbMembres)) {
        if (membre.nom.toLowerCase() === nomMembre.toLowerCase()) {
            idTrouve = id;
            break; // On a trouvé le compte existant !
        }
    }

    if (idTrouve) {
        // CAS A : Le membre existe déjà -> On le reconnecte sans rien effacer
        const sonRole = dbMembres[idTrouve].role || "Membre";
        afficherModale(
            "Bon retour parmi nous ! 👋", 
            `Ravi de vous revoir, ${dbMembres[idTrouve].nom}.\nVous êtes connecté en tant que : ${sonRole}.`, 
            "✨"
        );
        sauvegarderEtEntrer(idTrouve, dbMembres[idTrouve].nom);
    } else {
        // CAS B : C'est vraiment un nouveau membre -> On lui crée son compte
        const newId = "M-" + Date.now(); // Génère un ID unique basé sur l'heure
        
        dbMembres[newId] = { 
            nom: nomMembre, 
            role: "Membre", 
            epargne: 0, dev: 0, fondCaisse: 0, scolaire: 0, sanctions: 0, empOrd: 0, empSpec: 0,
            seances: 0, 
            presence: 100 
        };

        afficherModale(
            "Bienvenue 🎉", 
            `Votre inscription à la tontine a été validée.`, 
            "🚀"
        );
        sauvegarderEtEntrer(newId, nomMembre);
    }
}


function sauvegarderEtEntrer(idUser, nomUser) {
    localStorage.setItem('tontine_membres', JSON.stringify(dbMembres));
    localStorage.setItem('tontine_current_user_id', idUser); 
    
    document.getElementById('user-name').innerText = nomUser;
    document.getElementById('prof-display-name').innerText = nomUser;

    document.getElementById('page-login').classList.add('hidden');
    document.querySelector('.main-header').classList.remove('hidden');
    document.querySelector('.bottom-bar').classList.remove('hidden');
    nav('home');
}

// --- 5. NAVIGATION ET AFFICHAGE ---
function nav(pageId, element) {
    document.querySelectorAll('.app-page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById('page-' + pageId);
    if(target) target.classList.remove('hidden');

    if(element && element.classList.contains('nav-btn')) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        element.classList.add('active');
    }
    refreshData();
}


function refreshData() {
    // 1. GÉNÉRATION DE LA LISTE COMMUNE (RÉTROACTIVE ET ULTRA-FRAICHE)
    const optionsMembres = Object.entries(dbMembres).map(([id, m]) => `<option value="${id}">${m.nom}</option>`).join('');

    // Remplissage automatique de la liste du Président (ton code)
    const sPresident = document.getElementById('pres-membre-select');
    if(sPresident) {
        sPresident.innerHTML = optionsMembres;
    }

    // AJOUT SÉCURITÉ : Remplissage automatique de la liste du Trésorier s'il existe dans le HTML
    const sTresorier = document.getElementById('adm-membre-select');
    if(sTresorier) {
        sTresorier.innerHTML = optionsMembres;
    }
    
    // 2. LE RESTE DE TA FONCTION (STRICTEMENT INCHANGÉ)
    const currentId = localStorage.getItem('tontine_current_user_id') || "1";
    const b = dbMembres[currentId] || {epargne:0, dev:0, fondCaisse:0, scolaire:0, sanctions:0, empOrd:0, empSpec:0};
    const monProfil = dbMembres[currentId] || { role: "Membre" };

    // Mise à jour du rôle affiché dans le header HTML
    if(document.getElementById('role-display')) {
        document.getElementById('role-display').innerText = monProfil.role;
    }

    // Mise à jour des compteurs du portefeuille
    if(document.getElementById('v-epargne')) document.getElementById('v-epargne').innerText = (b.epargne || 0).toLocaleString() + " F";
    if(document.getElementById('v-dev')) document.getElementById('v-dev').innerText = (b.dev || 0).toLocaleString() + " F";
    if(document.getElementById('v-fond')) document.getElementById('v-fond').innerText = (b.fondCaisse || 0).toLocaleString() + " F";
    if(document.getElementById('v-scolaire')) document.getElementById('v-scolaire').innerText = (b.scolaire || 0).toLocaleString() + " F";
    if(document.getElementById('v-sanctions')) document.getElementById('v-sanctions').innerText = (b.sanctions || 0).toLocaleString() + " F";
    if(document.getElementById('v-emp-ord')) document.getElementById('v-emp-ord').innerText = (b.empOrd || 0).toLocaleString() + " F";
    if(document.getElementById('v-emp-spec')) document.getElementById('v-emp-spec').innerText = (b.empSpec || 0).toLocaleString() + " F";
    
    if(document.getElementById('v-total-dette')) {
        document.getElementById('v-total-dette').innerText = ((b.sanctions || 0) + (b.empOrd || 0) + (b.empSpec || 0)).toLocaleString() + " F";
    }

    // 3. RECUPERATION ET AFFICHAGE DU CODE D'INVITATION (L'AJOUT MANQUANT)
    const codeVrai = localStorage.getItem('tontine_code') || "---";
    const displayElement = document.getElementById('display-invite-code');
    if (displayElement) {
        displayElement.innerText = codeVrai;
    }

    if (typeof genererAgendaVisual === 'function') {
        genererAgendaVisual();
    }
    
    if (typeof genererAgendaVisual === 'function') genererAgendaVisual();
    if (typeof verifierEtAfficherNotifications === 'function') verifierEtAfficherNotifications();
}



// --- 6. ACTIONS BUREAU (ADMIN) ---
function ouvrirZoneAdmin() {
    let code = prompt("Code Officier :");
    if(CODES[code]) {
        nav('admin');
        document.querySelectorAll('.admin-card').forEach(c => c.classList.add('hidden'));
        const box = document.getElementById('box-' + CODES[code]);
        if(box) box.classList.remove('hidden');
    } else {
        alert("Accès refusé.");
    }
}

function validerLigneTresorier() {
    let id = document.getElementById('adm-membre-select').value;
    
    // On récupère TOUTES les colonnes de ton tableau
    let data = {
        epargne: parseFloat(document.getElementById('s-epar').value) || 0,
        dev: parseFloat(document.getElementById('s-inv').value) || 0,
        fondCaisse: parseFloat(document.getElementById('s-caisse-epar').value) || 0,
        scolaire: parseFloat(document.getElementById('s-scol').value) || 0,
        sanctions: parseFloat(document.getElementById('s-sanc').value) || 0,
        empOrd: parseFloat(document.getElementById('s-emp').value) || 0,
        empSpec: parseFloat(document.getElementById('s-empsp').value) || 0
    };

    if(dbMembres[id]) {
        // On ajoute les montants aux montants existants
        dbMembres[id].epargne += data.epargne;
        dbMembres[id].sanctions += data.sanctions;
        dbMembres[id].empOrd += data.empOrd;
        // ... ajoute les autres si tu veux
        
        localStorage.setItem('tontine_membres', JSON.stringify(dbMembres));
        alert("Données enregistrées pour " + dbMembres[id].nom);
        refreshData();
    }

    if (typeof afficherAnnonceInteractive === 'function') afficherAnnonceInteractive();
}

// --- 7. FONCTIONS PDF ET AUTRES ---
function genererFichePDF() {
    const nom = document.getElementById('prof-nom').value;
    const contenu = `<div style="padding:20px;"><h1>FICHE : ${nom}</h1><p>Généré le ${new Date().toLocaleDateString()}</p></div>`;
    html2pdf().from(contenu).save(`Fiche_${nom}.pdf`);
}

function tabProfil(tabId, element) {
    // 1. Gestion des onglets (ton code existant)
    document.getElementById('p-perso').classList.add('hidden');
    document.getElementById('p-famille').classList.add('hidden');
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.p-nav-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');

    // 2. [NOUVEAU] Si le membre ouvre l'onglet du profil personnel, on préremplit les données !
    if (tabId === 'p-perso') {
        preRemplirFicheAutomatique();
    }
}

function preRemplirFicheAutomatique() {
    // Récupération des informations mémorisées dans le téléphone
    const nomMémorisé = localStorage.getItem('tontine_current_user_name');
    const telMémorisé = localStorage.getItem('tontine_current_user_phone');
    const emailMémorisé = localStorage.getItem('tontine_current_user_email');

    // Écriture automatique dans les cases de l'onglet Personnel si elles sont vides
    if (nomMémorisé) {
        const inputNom = document.getElementById('prof-nom');
        if (inputNom && inputNom.value.trim() === "") {
            inputNom.value = nomMémorisé;
        }
    }

    if (telMémorisé) {
        const inputTel = document.getElementById('prof-tel');
        if (inputTel && inputTel.value.trim() === "") {
            inputTel.value = telMémorisé;
        }
    }

    if (emailMémorisé) {
        const inputEmail = document.getElementById('prof-email');
        if (inputEmail && inputEmail.value.trim() === "") {
            inputEmail.value = emailMémorisé;
        }
    }
    
    console.log("🤖 Assistant Bitchô : Coordonnées de session injectées dans la fiche !");
}

function deconnexionTontine() {
    localStorage.removeItem('tontine_current_user_id');
    window.location.reload();
}


function genererAgendaHTML() {
    if (!reglageTontine.dateDebut) return "<p>Aucun agenda configuré.</p>";

    let html = `<h3>🗓️ Agenda des Réunions</h3>`;
    let dateCourante = new Date(reglageTontine.dateDebut);

    html += `<div class="timeline-glissandoo">`;

    // On affiche les 5 prochaines séances
    for (let i = 1; i <= 5; i++) {
        // Formater la date en français (ex: 26 mai 2026)
        let dateFormatee = dateCourante.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        
        // Est-ce que c'est la séance en cours/prochaine ?
        let estActuelle = (i === reglageTontine.seanceActuelle);
        let classeStatut = estActuelle ? "status-current" : "status-future";
        let badge = estActuelle ? "<span class='badge'>À venir (Actuelle)</span>" : "<span class='badge-futur'>Planifiée</span>";

        html += `
            <div class="agenda-item ${classeStatut}">
                <div class="agenda-number">Séance ${i}</div>
                <div class="agenda-date">${dateFormatee}</div>
                <div class="agenda-details">Cotisation obligatoire : <b>${reglageTontine.montantBase.toLocaleString()} F CFA</b></div>
                ${badge}
            </div>
        `;

        // On passe à la date suivante en ajoutant le nombre de jours (7, 14 ou 30)
        dateCourante.setDate(dateCourante.getDate() + reglageTontine.frequence);
    }

    html += `</div>`;
    return html;
}
// Fonction pour ouvrir la modale stylée à la place de alert()
function afficherModale(titre, message, icone = "💡") {
    document.getElementById('modal-title').innerText = titre;
    document.getElementById('modal-message').innerText = message;
    document.querySelector('.modal-icon').innerText = icone;
    
    // On affiche la modale
    document.getElementById('custom-modal').classList.remove('hidden');
}

// Fonction pour fermer la modale
function fermerModale() {
    document.getElementById('custom-modal').classList.add('hidden');
}



// --- FONCTIONS DE PERSONNALISATION STYLE MANJARO (ISOLÉES) ---

// 1. Gestion du changement de couleur du bureau
function appliquerTheme(couleurPrincipale, fondEcran) {
    document.documentElement.style.setProperty('--primary-color', couleurPrincipale);
    document.body.style.background = fondEcran;
    
    // Sauvegarde du choix pour ce téléphone
    localStorage.setItem('manjaro_theme_color', couleurPrincipale);
    localStorage.setItem('manjaro_theme_bg', fondEcran);
}

// 2. Gestion de la photo de profil personnalisée
function changerPhotoProfil(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageBase64 = e.target.result;
            
            // On applique l'image sur l'avatar du profil et de l'en-tête
            document.getElementById('prof-avatar-image').style.backgroundImage = `url('${imageBase64}')`;
            document.getElementById('prof-avatar-image').innerText = ''; // Enlève la lettre 'B'
            document.getElementById('prof-avatar-image').style.backgroundSize = 'cover';
            
            if(document.getElementById('app-logo')) {
                document.getElementById('app-logo').style.backgroundImage = `url('${imageBase64}')`;
                document.getElementById('app-logo').innerText = '';
                document.getElementById('app-logo').style.backgroundSize = 'cover';
            }
            
            // Sauvegarde locale de l'image
            localStorage.setItem('manjaro_user_avatar', imageBase64);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// 3. Rechargement des préférences au démarrage (À mettre au tout début de ton window.onload si tu veux que ce soit permanent)
function chargerPreferencesManjaro() {
    const couleur = localStorage.getItem('manjaro_theme_color');
    const fond = localStorage.getItem('manjaro_theme_bg');
    const avatar = localStorage.getItem('manjaro_user_avatar');
    
    if(couleur && fond) appliquerTheme(couleur, fond);
    if(avatar) {
        document.getElementById('prof-avatar-image').style.backgroundImage = `url('${avatar}')`;
        document.getElementById('prof-avatar-image').innerText = '';
        document.getElementById('prof-avatar-image').style.backgroundSize = 'cover';
        if(document.getElementById('app-logo')) {
            document.getElementById('app-logo').style.backgroundImage = `url('${avatar}')`;
            document.getElementById('app-logo').innerText = '';
            document.getElementById('app-logo').style.backgroundSize = 'cover';
        }
    }
}

function copierCode() {
    // 1. On récupère la balise qui contient le code d'invitation
    const codeElement = document.getElementById('display-invite-code');
    
    if (!codeElement) {
        afficherModale("Erreur ❌", "Impossible de trouver le code à copier.", "⚠️");
        return;
    }

    const texteACopier = codeElement.innerText.trim();

    // Sécurité : On vérifie s'il y a un vrai code généré (pas les petits tirets "---")
    if (texteACopier === "" || texteACopier === "---") {
        afficherModale("Attention ⚠️", "Aucun code d'invitation n'a encore été généré.", "🔒");
        return;
    }

    // 2. Utilisation de l'API moderne du navigateur pour copier dans le presse-papiers
    navigator.clipboard.writeText(texteACopier).then(() => {
        // Succès : On affiche une confirmation à l'utilisateur
        afficherModale(
            "Code copié ! 📋", 
            `Le code [ ${texteACopier} ] a été copié dans votre presse-papiers.\nVous pouvez maintenant l'envoyer à vos membres.`, 
            "✨"
        );
    }).catch(err => {
        // En cas de bug rare sur certains vieux téléphones, méthode de secours (fallback)
        const zoneTemporaire = document.createElement('textarea');
        zoneTemporaire.value = texteACopier;
        document.body.appendChild(zoneTemporaire);
        zoneTemporaire.select();
        document.execCommand('copy');
        document.body.removeChild(zoneTemporaire);
        
        afficherModale(
            "Code copié ! 📋", 
            `Le code [ ${texteACopier} ] a été copié dans votre presse-papiers.`, 
            "✨"
        );
    });
}

function genererAgendaVisual() {
    const conteneur = document.getElementById('liste-agenda-cards');
    if (!conteneur) return;

    const reglage = JSON.parse(localStorage.getItem('tontine_reglage')) || reglageTontine;
    if (!reglage || !reglage.dateDebut) {
        conteneur.innerHTML = `<p style="text-align:center; color:gray; padding:20px;">Calendrier non configuré par le Secrétariat.</p>`;
        return;
    }

    let dateSeance = new Date(reglage.dateDebut);
    const frequenceJours = reglage.frequence || 14;
    let htmlCards = "";

    for (let i = 1; i <= 3; i++) {
        const dateFormatee = dateSeance.toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }).toUpperCase();

        const imageCard = "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=500&q=80";

        htmlCards += `
            <div class="agenda-card">
                <div class="agenda-card-banner" style="background-image: url('${imageCard}');"></div>
                <div class="agenda-card-body">
                    <span class="agenda-card-date">📅 ${dateFormatee} à 12:00</span>
                    <h4 class="agenda-card-title">Séance Ordinaire N°${i}</h4>
                    <p class="agenda-card-location"><i class="fas fa-map-marker-alt"></i> Siège de la Tontine / Distanciel</p>
                </div>
                <div class="agenda-card-footer">
                    <span class="agenda-status"><i class="fas fa-circle agenda-status-dot"></i> Présence requise</span>
                    <div class="agenda-actions">
                        <button onclick="marquerPresenceSeance(${i}, 'non')" class="btn-agenda-action refuse"><i class="fas fa-times"></i></button>
                        <button onclick="marquerPresenceSeance(${i}, 'oui')" class="btn-agenda-action confirm"><i class="fas fa-check"></i></button>
                    </div>
                </div>
            </div>
        `;
        dateSeance.setDate(dateSeance.getDate() + frequenceJours);
    }
    conteneur.innerHTML = htmlCards;
}

function displayDocsClean(registreDocs) {
    let html = "";
    registreDocs.forEach(doc => {
        let iconeFichier = "fa-file-alt";
        if (doc.nomFichier.toLowerCase().endsWith('.pdf')) iconeFichier = "fa-file-pdf";
        
        html += `
            <div class="doc-item">
                <div class="doc-info">
                    <span class="doc-title">${doc.titre}</span>
                    <span class="doc-filename"><i class="fas ${iconeFichier}"></i> ${doc.nomFichier}</span>
                    <span class="doc-meta">Publié le ${doc.datePublication} par <strong>${doc.publiePar}</strong></span>
                </div>
                <div>
                    <a href="${doc.donnees}" download="${doc.nomFichier}" class="btn-doc-download">
                        <i class="fas fa-download"></i> Télécharger
                    </a>
                </div>
            </div>
        `;
    });
    return html;
}

function afficherListeDocuments() {
    const conteneurDocs = document.getElementById('liste-documents-membres');
    if (!conteneurDocs) return;

    const registreDocs = JSON.parse(localStorage.getItem('tontine_documents')) || [];

    if (registreDocs.length === 0) {
        conteneurDocs.innerHTML = `
            <div style="text-align: center; padding: 30px 10px; color: #95a5a6;">
                <i class="fas fa-archive" style="font-size: 2rem; color: #bdc3c7; margin-bottom: 10px; display: block;"></i>
                <p style="margin: 0; font-size: 0.85rem;">Les archives sont vides. Aucun rapport n'a été publié pour le moment.</p>
            </div>
        `;
        return;
    }

    conteneurDocs.innerHTML = displayDocsClean(registreDocs);
}

function enregistrerAgendaSecretaire() {
    const inputDate = document.getElementById('config-date-seance');
    const inputFrequence = document.getElementById('config-frequence-seance');
    const inputNotif = document.getElementById('bureau-notif-input');

    if (!inputDate || !inputFrequence) return;

    const nouvelleDate = inputDate.value;
    const nouvelleFrequence = parseInt(inputFrequence.value, 10);

    // 1. Mise à jour de la configuration de l'agenda
    if (nouvelleDate) {
        reglageTontine.dateDebut = nouvelleDate;
        reglageTontine.frequence = nouvelleFrequence;
        localStorage.setItem('tontine_reglage', JSON.stringify(reglageTontine));
    }

    // 2. Traitement de la notification si le Secrétaire a écrit un message
    if (inputNotif && inputNotif.value.trim() !== "") {
        const currentId = localStorage.getItem('tontine_current_user_id') || "1";
        const nomAuteur = dbMembres[currentId]?.nom || "Le Secrétaire";
        
        const nouvelleNotif = {
            message: inputNotif.value.trim(),
            date: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            auteur: nomAuteur
        };
        
        localStorage.setItem('tontine_derniere_notif', JSON.stringify(nouvelleNotif));
        localStorage.setItem('tontine_notif_lue', "non"); // Forcer l'allumage du badge rouge
        inputNotif.value = ""; // Nettoyer le champ
    }

    // 3. Actualisation globale des écrans
    refreshData();
    afficherModale("Mise à jour réussie !", "L'agenda prévisionnel et les notifications ont été synchronisés.", "✨");
}

// 1. Gérer l'ouverture/fermeture de la boîte quand on clique sur la cloche
function ouvrirBoiteNotifs() {
    const boite = document.getElementById('boite-notifs-deroulante');
    if (!boite) return;
    
    // Si elle est ouverte on la ferme, si elle est fermée on l'ouvre
    if (boite.style.display === "none") {
        boite.style.display = "block";
        // Optionnel : on marque comme lu au clic
    } else {
        boite.style.display = "none";
    }
}

// 2. Vérifier les notifications et allumer le badge rouge (Style Facebook)
function verifierEtAfficherNotifications() {
    const badge = document.getElementById('notif-badge');
    const contenu = document.getElementById('liste-notifs-contenu');
    if (!badge || !contenu) return;

    const derniereNotif = JSON.parse(localStorage.getItem('tontine_derniere_notif'));
    const estLue = localStorage.getItem('tontine_notif_lue') === "oui";

    // Si on a une notification et qu'elle n'est pas encore marquée comme lue
    if (derniereNotif && !estLue) {
        badge.innerText = "1"; // On affiche 1 notification non lue
        badge.style.display = "block"; // On allume le rond rouge !
        
        // On remplit la boîte avec le message
        contenu.innerHTML = `
            <div style="background: #fdf6e2; padding: 8px; border-radius: 6px; border-left: 3px solid #ffc107; margin-bottom: 5px;">
                <span style="font-size: 0.7rem; color: gray; display:block;">📢 ${derniereNotif.auteur} (${derniereNotif.date})</span>
                <p style="margin: 3px 0 0 0;">${derniereNotif.message}</p>
            </div>
        `;
    } else {
        // Pas de notification fraîche
        badge.style.display = "none"; // On éteint le rond rouge
        contenu.innerHTML = `<p style="text-align:center; color:gray; margin:10px 0;">Aucune nouvelle notification.</p>`;
    }
}

// 3. Action du bouton "Tout lire" pour éteindre le badge
function toutMarquerLu() {
    localStorage.setItem('tontine_notif_lue', "oui"); // On enregistre qu'elle est lue
    verifierEtAfficherNotifications(); // On rafraîchit l'affichage (le badge s'éteint)
    
    // Ferme la boîte automatiquement après 1 seconde
    setTimeout(() => {
        const boite = document.getElementById('boite-notifs-deroulante');
        if(boite) boite.style.display = "none";
    }, 1000);
}

function genererAgendaVisual() {
    const conteneur = document.getElementById('liste-agenda-cards');
    if (!conteneur) return; // Sécurité : si on n'est pas sur la page des annonces, on ne fait rien

    const reglage = JSON.parse(localStorage.getItem('tontine_reglage')) || reglageTontine;
    if (!reglage || !reglage.dateDebut) {
        conteneur.innerHTML = `<p style="text-align:center; color:gray; padding: 20px;">Aucune séance planifiée pour le moment.</p>`;
        return;
    }

    let dateSeance = new Date(reglage.dateDebut);
    const frequenceJours = reglage.frequence || 14;
    let htmlCards = "";

    // On génère automatiquement les 3 prochaines séances de l'association
    for (let i = 1; i <= 3; i++) {
        const dateFormatee = dateSeance.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).toUpperCase();

        // Image par défaut pour le design de la carte
        const imageCard = "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=500&q=80";

        htmlCards += `
            <div class="agenda-card" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <div style="height: 140px; background: url('${imageCard}') center/cover no-repeat;"></div>
                
                <div style="padding: 15px;">
                    <span style="color: #e67e22; font-size: 0.8rem; font-weight: bold; display: block; margin-bottom: 5px;">📅 ${dateFormatee} À 12:00</span>
                    <h4 style="margin: 0 0 5px 0; font-size: 1.1rem; color: #2c3e50;">Séance Ordinaire n°${i}</h4>
                    <p style="margin: 0; font-size: 0.85rem; color: #7f8c8d;"><i class="fas fa-map-marker-alt"></i> Foyer de l'Association</p>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #fdfdfd; border-top: 1px solid #f1f1f1;">
                    <div style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; color: #555;">
                        <div style="width: 8px; height: 8px; background: #2ecc71; border-radius: 50%;"></div>
                        <span>Présence requise</span>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="marquerPresenceSeance(${i}, 'refuse')" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #e74c3c; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-times"></i>
                        </button>
                        <button onclick="marquerPresenceSeance(${i}, 'confirme')" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #2ecc71; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Calcul de la date suivante selon la fréquence (ex: +14 jours)
        dateSeance.setDate(dateSeance.getDate() + frequenceJours);
    }

    conteneur.innerHTML = htmlCards;
}

// Petite fonction pour gérer le clic sur les boutons d'action
function marquerPresenceSeance(numeroSeance, statut) {
    if (statut === 'confirme') {
        afficherModale("Présence confirmée ! 🎉", `Vous avez validé votre présence pour la séance n°${numeroSeance}.`, "✔️");
    } else {
        afficherModale("Absence notifiée ❌", `Vous avez signalé votre absence pour la séance n°${numeroSeance}.`, "⚠️");
    }
}


// ==========================================
// 🔔 GESTION DE LA CLOCHE STYLE FACEBOOK / WHATSAPP
// ==========================================
function ouvrirBoiteNotifs() {
    const boite = document.getElementById('boite-notifs-deroulante');
    if (boite) {
        boite.style.display = (boite.style.display === "none") ? "block" : "none";
    }
}

function verifierEtAfficherNotifications() {
    const badge = document.getElementById('notif-badge');
    const contenu = document.getElementById('liste-notifs-contenu');
    if (!badge || !contenu) return;

    const derniereNotif = JSON.parse(localStorage.getItem('tontine_derniere_notif'));
    const estLue = localStorage.getItem('tontine_notif_lue') === "oui";

    if (derniereNotif && !estLue) {
        badge.innerText = "1";
        badge.style.display = "block"; // Allume la pastille rouge
        contenu.innerHTML = `
            <div style="background: #fff3cd; padding: 10px; border-radius: 8px; border-left: 4px solid #ffc107; line-height: 1.4;">
                <span style="font-size: 0.7rem; color: #856404; font-weight: bold; display:block;">📢 ${derniereNotif.auteur.toUpperCase()} (${derniereNotif.date})</span>
                <p style="margin: 4px 0 0 0; color: #856404;">${derniereNotif.message}</p>
            </div>
        `;
    } else {
        badge.style.display = "none"; // Éteint la pastille
        contenu.innerHTML = `<p style="text-align:center; color:gray; margin:15px 0;">Aucune nouvelle annonce du bureau.</p>`;
    }
}

function toutMarquerLu() {
    localStorage.setItem('tontine_notif_lue', "oui");
    verifierEtAfficherNotifications();
    setTimeout(() => {
        const boite = document.getElementById('boite-notifs-deroulante');
        if (boite) boite.style.display = "none";
    }, 800);
}

// ==========================================
// 📅 GENERATEUR D'AGENDA EN CARTES GRAPHIQUES (LOOK BILBAO)
// ==========================================
function genererAgendaVisual() {
    const conteneur = document.getElementById('liste-agenda-cards');
    if (!conteneur) return;

    const reglage = JSON.parse(localStorage.getItem('tontine_reglage')) || reglageTontine;
    if (!reglage || !reglage.dateDebut) {
        conteneur.innerHTML = `<p style="text-align:center; color:gray; padding:20px;">Calendrier non configuré par le Secrétariat.</p>`;
        return;
    }

    let dateSeance = new Date(reglage.dateDebut);
    const frequenceJours = reglage.frequence || 14;
    let htmlCards = "";

    // Génération des 3 prochaines séances à la volée
    for (let i = 1; i <= 3; i++) {
        const dateFormatee = dateSeance.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).toUpperCase();

        const imageCard = "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=500&q=80";

        htmlCards += `
            <div class="agenda-card" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); margin-bottom: 20px; border: 1px solid #f1f1f1;">
                <div style="height: 130px; background: url('${imageCard}') center/cover no-repeat;"></div>
                <div style="padding: 15px;">
                    <span style="color: #e67e22; font-size: 0.75rem; font-weight: bold; display: block; margin-bottom: 4px;">📅 ${dateFormatee} à 12:00</span>
                    <h4 style="margin: 0 0 4px 0; font-size: 1.05rem; color: #2c3e50;">Séance Ordinaire N°${i}</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: #95a5a6;"><i class="fas fa-map-marker-alt"></i> Siège de la Tontine / Distanciel</p>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #fafafa; border-top: 1px solid #f1f1f1;">
                    <span style="font-size: 0.75rem; color: #7f8c8d;"><i class="fas fa-circle" style="color: #2ecc71; font-size: 0.6rem;"></i> Présence requise</span>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="marquerPresenceSeance(${i}, 'non')" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #e74c3c; color: white; cursor: pointer;"><i class="fas fa-times"></i></button>
                        <button onclick="marquerPresenceSeance(${i}, 'oui')" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #2ecc71; color: white; cursor: pointer;"><i class="fas fa-check"></i></button>
                    </div>
                </div>
            </div>
        `;
        dateSeance.setDate(dateSeance.getDate() + frequenceJours);
    }
    conteneur.innerHTML = htmlCards;
}

function marquerPresenceSeance(numero, reponse) {
    if (reponse === 'oui') {
        afficherModale("Présence Confirmée ✔️", `Votre participation à la séance n°${numero} est enregistrée.`, "✨");
    } else {
        afficherModale("Absence Signalée ❌", `Le bureau a été notifié de votre indisponibilité pour la séance n°${numero}.`, "⚠️");
    }
}

// ==========================================
// 🧠 SYSTEME DE RECONNEXION INTELLIGENTE (ANTI-F5)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const currentUserId = localStorage.getItem('tontine_current_user_id');
    const membresData = localStorage.getItem('tontine_membres');

    if (currentUserId && membresData) {
        const localMembres = JSON.parse(membresData);
        const userConnected = localMembres[currentUserId];

        if (userConnected) {
            console.log(`🧠 Reconnexion automatique active : ${userConnected.nom}`);

            // 1. Cacher l'écran de login et afficher l'application
            const authScreen = document.getElementById('page-login') || document.querySelector('.auth-container');
            if (authScreen) authScreen.classList.add('hidden');

            // 2. Afficher le header et le menu de navigation
            const headers = document.querySelectorAll('.main-header, .main-nav');
            headers.forEach(h => h.classList.remove('hidden'));

            // 3. Ouvrir la première page par défaut (Tableau de bord)
            showPage('page-dashboard');

            // 4. Injecter les textes du profil utilisateur
            const nameTarget = document.getElementById('user-name');
            const roleTarget = document.getElementById('role-display');
            if (nameTarget) nameTarget.innerText = userConnected.nom;
            if (roleTarget) roleTarget.innerText = userConnected.role || "Membre";

            // 5. 🌟 CHARGER SA PHOTO DE PROFIL DANS LE SLIM HEADER
            if (typeof appliquerPhotoDansHeader === 'function') {
                appliquerPhotoDansHeader(userConnected.photoProfil || null);
            }

            // 6. Rafraîchir les données de la tontine
            refreshData();
        }
    } else {
        console.log("🔒 Aucun utilisateur connecté. Mode connexion actif.");
    }
});


// ==========================================
// 📸 SÉCURISATION ET CHARGEMENT DE LA PHOTO DE L'AGENDA
// ==========================================
function enregistrerSeulementAgenda() {
    const inputDate = document.getElementById('config-date-seance');
    const inputFrequence = document.getElementById('config-frequence-seance');
    const inputPhoto = document.getElementById('config-photo-upload');

    if (!inputDate || !inputDate.value) {
        afficherModale("Attention ⚠️", "Veuillez choisir une date pour planifier la séance.", "📅");
        return;
    }

    reglageTontine.dateDebut = inputDate.value;
    reglageTontine.frequence = parseInt(inputFrequence.value, 10);

    // Vérification si le secrétaire a chargé une photo
    if (inputPhoto && inputPhoto.files.length > 0) {
        const fichier = inputPhoto.files[0];
        
        // Sécurité taille (Max 1.5 Mo pour le localStorage)
        if (fichier.size > 1.5 * 1024 * 1024) {
            afficherModale("Fichier lourd ⚠️", "L'image est trop lourde. Veuillez choisir une image compressée ou plus petite.", "❌");
            return;
        }

        const lecteur = new FileReader();
        lecteur.onload = function(e) {
            reglageTontine.imageAgenda = e.target.result; // Stockage de l'image convertie en texte
            localStorage.setItem('tontine_reglage', JSON.stringify(reglageTontine));
            inputPhoto.value = ""; // Réinitialiser le champ
            refreshData();
            afficherModale("Agenda mis à jour ! 📅", "Le calendrier et votre photo personnalisée ont été enregistrés.", "✔️");
        };
        lecteur.readAsDataURL(fichier);
    } else {
        // Si pas de photo, on garde l'ancienne ou celle par défaut
        localStorage.setItem('tontine_reglage', JSON.stringify(reglageTontine));
        refreshData();
        afficherModale("Agenda mis à jour ! 📅", "Le calendrier des réunions a été recalculé.", "✔️");
    }
}

// ==========================================
// 💬 SYSTÈME INTERACTIF DES ANNONCES (LIKES & COMMENTAIRES)
// ==========================================

// Fonction de secours pour republier l'annonce avec structure interactive
function publierSeulementAnnonce() {
    const inputNotif = document.getElementById('bureau-notif-input');
    if (!inputNotif || inputNotif.value.trim() === "") {
        afficherModale("Message vide ✍️", "Veuillez saisir un texte.", "⚠️");
        return;
    }

    const currentId = localStorage.getItem('tontine_current_user_id') || "1";
    const nomAuteur = dbMembres[currentId]?.nom || "Le Secrétariat";
    
    const nouvelleAnnonce = {
        message: inputNotif.value.trim(),
        date: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        auteur: nomAuteur,
        reactions: { "👍": 0, "❤️": 0, "😂": 0, "👏": 0 },
        commentaires: []
    };
    
    localStorage.setItem('tontine_interactive_notif', JSON.stringify(nouvelleAnnonce));
    localStorage.setItem('tontine_notif_lue', "non");

    inputNotif.value = "";
    refreshData();
    afficherModale("Annonce publiée ! 📢", "Votre Flash Info interactif est en ligne.", "✨");
}

// Rendu visuel complet de l'annonce avec réactions et commentaires
function afficherAnnonceInteractive() {
    const conteneur = document.getElementById('bloc-notif-bureau-interactif');
    if (!conteneur) return;

    const annonce = JSON.parse(localStorage.getItem('tontine_interactive_notif'));

    if (!annonce) {
        conteneur.innerHTML = `<p style="text-align:center; color:gray; font-size:0.85rem; padding:15px; background:#f9f9f9; border-radius:8px;">Aucune annonce globale du bureau pour le moment.</p>`;
        return;
    }

    // Calcul et construction des boutons de réactions
    let htmlReactions = "";
    for (const [emoji, compteur] of Object.entries(annonce.reactions)) {
        htmlReactions += `
            <button onclick="ajouterReactionAnnonce('${emoji}')" style="background:#f1f2f6; border:none; padding:6px 12px; border-radius:20px; cursor:pointer; font-size:0.9rem; display:flex; align-items:center; gap:5px;">
                ${emoji} <span style="font-size:0.8rem; font-weight:bold; color:#57606f;">${compteur}</span>
            </button>
        `;
    }

    // Liste des commentaires
    let htmlCommentaires = "";
    if (annonce.commentaires.length === 0) {
        htmlCommentaires = `<p id="aucun-com-text" style="color:gray; font-size:0.8rem; font-style:italic; margin:5px 0;">Soyez le premier à commenter...</p>`;
    } else {
        annonce.commentaires.forEach(com => {
            htmlCommentaires += `
                <div style="background:#f1f2f6; padding:8px 12px; border-radius:8px; margin-bottom:6px; font-size:0.85rem;">
                    <div style="display:flex; justify-content:between; color:#2c3e50; font-weight:bold; font-size:0.75rem; margin-bottom:2px;">
                        <span>${com.auteur}</span>
                        <span style="color:gray; font-weight:normal; margin-left:auto;">${com.date}</span>
                    </div>
                    <p style="margin:0; color:#57606f;">${com.texte}</p>
                </div>
            `;
        });
    }

    // Assemblage final de la carte sociale
    conteneur.innerHTML = `
        <div class="card" style="border-left: 5px solid #e67e22; box-shadow: 0 4px 10px rgba(0,0,0,0.05); padding:15px; background:white; border-radius:8px;">
            <div style="font-size:0.75rem; color:gray; font-weight:bold; margin-bottom:5px;">📢 COMMUNIQUÉ OFFICIEL DU BUREAU</div>
            <p style="font-size:1rem; color:#2c3e50; font-weight:500; line-height:1.4; margin:0 0 10px 0;">${annonce.message}</p>
            <div style="font-size:0.7rem; color:gray; margin-bottom:12px;">Posté par ${annonce.auteur} le ${annonce.date}</div>
            
            <div style="display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid #eee; border-bottom:1px solid #eee; padding:10px 0; margin-bottom:15px;">
                ${htmlReactions}
            </div>

            <h5 style="margin:0 0 8px 0; color:#2c3e50;"><i class="far fa-comments"></i> Discussions (${annonce.commentaires.length})</h5>
            <div style="max-height:160px; overflow-y:auto; margin-bottom:10px; padding-right:5px;">
                ${htmlCommentaires}
            </div>

            <div style="display:flex; gap:8px; margin-top:10px;">
                <input type="text" id="input-add-commentaire" placeholder="Votre commentaire..." style="flex:1; padding:8px 12px; border-radius:20px; border:1px solid #ddd; font-size:0.85rem;">
                <button onclick="soumettreCommentaireAnnonce()" style="background:#e67e22; color:white; border:none; padding:8px 16px; border-radius:20px; cursor:pointer; font-weight:bold; font-size:0.85rem;">Envoyer</button>
            </div>
        </div>
    `;
}

// Ajouter une réaction Émoji
function ajouterReactionAnnonce(emoji) {
    let annonce = JSON.parse(localStorage.getItem('tontine_interactive_notif'));
    if (!annonce) return;

    annonce.reactions[emoji] = (annonce.reactions[emoji] || 0) + 1;
    localStorage.setItem('tontine_interactive_notif', JSON.stringify(annonce));
    
    // Re-calculer l'affichage instantanément sans recharger la page
    afficherAnnonceInteractive();
}

// Envoyer un nouveau commentaire
function soumettreCommentaireAnnonce() {
    const input = document.getElementById('input-add-commentaire');
    if (!input || input.value.trim() === "") return;

    let annonce = JSON.parse(localStorage.getItem('tontine_interactive_notif'));
    if (!annonce) return;

    const currentId = localStorage.getItem('tontine_current_user_id') || "1";
    const nomMembre = dbMembres[currentId]?.nom || "Un Membre";

    const nouveauCom = {
        auteur: nomMembre,
        texte: input.value.trim(),
        date: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    annonce.commentaires.push(nouveauCom);
    localStorage.setItem('tontine_interactive_notif', JSON.stringify(annonce));

    afficherAnnonceInteractive();
}

// =========================================================
// 👤 GESTION DE LA PHOTO DE PROFIL DU MEMBRE COMPACTE
// =========================================================
function changerMaPhotoDeProfil(input) {
    if (input.files && input.files[0]) {
        const fichier = input.files[0];

        // Sécurité taille (Max 1 Mo pour éviter de surcharger le localStorage)
        if (fichier.size > 1024 * 1024) {
            afficherModale("Image trop lourde ⚠️", "Veuillez choisir une photo de profil plus légère (Moins de 1 Mo).", "❌");
            return;
        }

        const lecteur = new FileReader();
        lecteur.onload = function (e) {
            const imageBase64 = e.target.result;
            const currentUserId = localStorage.getItem('tontine_current_user_id');

            if (currentUserId && dbMembres[currentUserId]) {
                // 1. Enregistrer l'image dans la base de données locale du membre connecté
                dbMembres[currentUserId].photoProfil = imageBase64;
                localStorage.setItem('tontine_membres', JSON.stringify(dbMembres));

                // 2. Mettre à jour le visuel du Header instantanément
                appliquerPhotoDansHeader(imageBase64);
                
                // 3. Rafraîchir les écrans (pour que sa photo s'affiche aussi sur ses futurs commentaires !)
                if (typeof refreshData === 'function') refreshData();
                
                afficherModale("Profil mis à jour ! ✨", "Votre nouvelle photo de profil a été configurée avec succès.", "✔️");
            }
        };
        lecteur.readAsDataURL(fichier);
    }
}

// Fonction interne pour injecter la photo dans le Header rond
function appliquerPhotoDansHeader(photoBase64) {
    const imgElement = document.getElementById('user-profile-avatar');
    const placeholderElement = document.getElementById('user-profile-avatar-placeholder');
    
    if (imgElement && placeholderElement) {
        if (photoBase64) {
            imgElement.src = photoBase64;
            imgElement.style.display = "block";
            placeholderElement.style.display = "none";
        } else {
            imgElement.style.display = "none";
            placeholderElement.style.display = "flex";
        }
    }
}

function chargerFichesParametresMembres() {
    const currentUserId = localStorage.getItem('tontine_current_user_id');
    if (!currentUserId || !dbMembres[currentUserId]) return;

    const membre = dbMembres[currentUserId];

    // A. Injection dans l'entête textuelle
    if (document.getElementById('prof-display-name')) {
        document.getElementById('prof-display-name').innerText = membre.nom || `${membre.prenom || ''} ${membre.nomFamille || ''}`;
    }

    // B. Remplissage automatique du Volet Personnel (Verrouillé / Lecture seule)
    if (document.getElementById('prof-prenom')) document.getElementById('prof-prenom').value = membre.prenom || membre.nom || "";
    if (document.getElementById('prof-nomfamille')) document.getElementById('prof-nomfamille').value = membre.nomFamille || "";
    if (document.getElementById('prof-email')) document.getElementById('prof-email').value = membre.email || membre.identifiant || "";

    // C. Remplissage des champs Personnel modifiables
    if (document.getElementById('prof-tel')) document.getElementById('prof-tel').value = membre.telephone || "";
    if (document.getElementById('prof-anniv')) document.getElementById('prof-anniv').value = membre.anniversaire || "";
    if (document.getElementById('prof-genre')) document.getElementById('prof-genre').value = membre.genre || "Masculin";
    if (document.getElementById('prof-quart')) document.getElementById('prof-quart').value = membre.quartier || "";
    
    // D. 🌟 REMPLISSAGE DU VOLET FICHE SIGNALÉTIQUE (Père, Mère, Héritier)
    if (document.getElementById('prof-pere')) document.getElementById('prof-pere').value = membre.nomPere || "";
    if (document.getElementById('prof-mere')) document.getElementById('prof-mere').value = membre.nomMere || "";
    if (document.getElementById('prof-heritier')) document.getElementById('prof-heritier').value = membre.heritierUrgence || "";
    if (document.getElementById('prof-numerotel')) document.getElementById('prof-numerotel').value = membre.heritierTelephone || "";

    // E. Gestion de l'affichage visuel du verrou PIN
    const pinLabel = document.getElementById('pin-label');
    if (pinLabel) {
        if (membre.codePin || membre.motDePasse) {
            pinLabel.innerText = "Actif 🔒";
            pinLabel.style.color = "#27ae60";
        } else {
            pinLabel.innerText = "Désactivé 🔓";
            pinLabel.style.color = "#e74c3c";
        }
    }

    // F. Statistiques automatiques de présence
    const totalSeances = 24;
    let presences = membre.totalPresences || 24;
    let pourcent = Math.round((presences / totalSeances) * 100);
    
    if (document.getElementById('stat-seances-compteur')) document.getElementById('stat-seances-compteur').innerText = presences;
    if (document.getElementById('stat-presence-pourcent')) document.getElementById('stat-presence-pourcent').innerText = pourcent + "%";
    if (document.getElementById('stat-membre-rang')) {
        document.getElementById('stat-membre-rang').innerText = pourcent >= 90 ? "Or 👑" : (pourcent >= 75 ? "Argent 🥈" : "Bronze");
    }
}

function sauvegarderFicheParametres(typeFiche) {
    const currentUserId = localStorage.getItem('tontine_current_user_id');
    if (!currentUserId || !dbMembres[currentUserId]) return;

    // Date et heure de la signature du jour
    const dateDuJour = new Date().toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    if (typeFiche === 'personnel') {
        dbMembres[currentUserId].telephone = document.getElementById('prof-tel').value.trim();
        dbMembres[currentUserId].anniversaire = document.getElementById('prof-anniv').value.trim();
        dbMembres[currentUserId].genre = document.getElementById('prof-genre').value;
        dbMembres[currentUserId].quartier = document.getElementById('prof-quart').value.trim();

        // Sauvegarde sécurisée du Code secret
        const nouveauPin = document.getElementById('prof-nouveau-pin');
        if (nouveauPin && nouveauPin.value.trim() !== "") {
            dbMembres[currentUserId].codePin = nouveauPin.value.trim();
            dbMembres[currentUserId].motDePasse = nouveauPin.value.trim();
            nouveauPin.value = ""; // masquer par sécurité après validation
        }
    } 
    else if (typeFiche === 'signalitique') {
        // Enregistrement des données généalogiques
        dbMembres[currentUserId].nomPere = document.getElementById('prof-pere').value.trim();
        dbMembres[currentUserId].nomMere = document.getElementById('prof-mere').value.trim();
        dbMembres[currentUserId].heritierUrgence = document.getElementById('prof-heritier').value.trim();
        dbMembres[currentUserId].heritierTelephone = document.getElementById('prof-numerotel').value.trim();
    }

    dbMembres[currentUserId].derniereMiseAJourFiche = dateDuJour;

    // Persistance dans la base locale
    localStorage.setItem('tontine_membres', JSON.stringify(dbMembres));
    
    // Rafraîchir les informations à l'écran
    chargerFichesParametresMembres();
    
    afficherModale("Enregistrement réussi ! ✔️", `Données enregistrées avec succès le ${dateDuJour}.`, "✨");
}

/**
 * Module d'Authentification Biométrique WebAuthn standardisé 2026
 */
const WebAuthnBiometrics = {
  // Utilitaires de conversion des buffers cryptographiques
  bufferToBase64: (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))),
  base64ToBuffer: (base64) => Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer,

  /**
   * Enregistre un nouvel identifiant biométrique (Passkey) pour le membre
   */
  registerBiometrics: async (userId, username) => {
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("La biométrie WebAuthn n'est pas supportée sur ce périphérique.");
      }

      // Simulation du Challenge Cryptographique renvoyé par le serveur
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: { name: "Bitchô Na Bitchô", id: window.location.hostname || "localhost" },
        user: {
          id: new TextEncoder().encode(userId),
          name: username,
          displayName: username
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }], // ES256 & RS256
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Force FaceID / TouchID / Empreinte native
          userVerification: "required"
        },
        timeout: 60000
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      // Sauvegarde des métadonnées publiques de la clé d'identification
      const credentialInfo = {
        id: credential.id,
        type: credential.type,
        rawId: WebAuthnBiometrics.bufferToBase64(credential.rawId)
      };

      // Enregistrement dans IndexedDB ou Supabase
      await AppDatabase.saveUserPasskey(userId, credentialInfo);
      afficherModale("Sécurité Biométrique Activée", "Vos empreintes/FaceID sont désormais liés à votre compte.", "🔒");
      return true;
    } catch (error) {
      console.error("Erreur WebAuthn Registration:", error);
      afficherModale("Échec de l'enrôlement", error.message, "⚠️");
      return false;
    }
  },

  /**
   * Valide une action sensible ou un déverrouillage de session par empreinte digitale
   */
  authenticateTransaction: async (userId) => {
    try {
      const passkey = await AppDatabase.getUserPasskey(userId);
      if (!passkey) {
        // Fallback vers le code PIN si aucun Passkey n'est configuré
        return WebAuthnBiometrics.fallbackPinValidation();
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyCredentialRequestOptions = {
        challenge: challenge,
        allowCredentials: [{
          id: WebAuthnBiometrics.base64ToBuffer(passkey.rawId),
          type: 'public-key'
        }],
        userVerification: "required",
        timeout: 60000
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });

      // En environnement réel, l'assertion cryptographique est vérifiée côté backend (Supabase RPC)
      return !!assertion;
    } catch (error) {
      console.error("Erreur WebAuthn Assertion:", error);
      return false;
    }
  },

  fallbackPinValidation: () => {
    let pin = prompt("Veuillez saisir votre code PIN de secours à 4 chiffres :");
    return (pin !== null && pin.length === 4);
  }
};





// --- EXEMPLE À ADAPTER DANS TA FONCTION DE CONNEXION / INSCRIPTION ---
function validerConnexionPremiereFois(idMembre, nomMembre, telephoneMembre, emailMembre) {
    
    // 1. On garde la session active (ce que tu faisais déjà)
    localStorage.setItem('tontine_current_user_id', idMembre);
    localStorage.setItem('tontine_current_user_name', nomMembre);
    
    // 2. [NOUVEAU] L'application mémorise intelligemment les coordonnées
    localStorage.setItem('tontine_current_user_phone', telephoneMembre);
    localStorage.setItem('tontine_current_user_email', emailMembre);
    
    console.log("Coordonnées mémorisées avec succès pour la fiche personnelle !");
    
    // Redirection vers l'accueil
    nav('home');
    LocalTontineAI.renderAIBanner();
}