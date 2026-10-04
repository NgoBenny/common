export const metadata = {
  title: "Privacy policy",
  description:
    "How Common uses account details, public content and service providers.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p>
        Updated October 3, 2026. Common is a community discussion project
        operated by Benny Ngo in Santa Clara, California. Contact{" "}
        <a href="mailto:bkvngo@gmail.com">bkvngo@gmail.com</a> about privacy.
      </p>
      <h2>What we use</h2>
      <p>
        Kinde handles sign-in and can receive your email, name and profile image
        from your chosen sign-in provider. Common uses an account identifier and
        username to connect your posts, comments, votes, memberships, saved
        posts, reports and notifications. Older accounts may also have an email,
        name and image URL stored in our database.
      </p>
      <p>
        Your username, communities, posts, comments and contribution history are
        public. Votes, saved posts, memberships and notifications support your
        account experience. Reports are shown to the relevant community
        moderator. Do not post information you want to keep private.
      </p>
      <p>
        We also keep participation restrictions and moderation history, including
        reasons, expiry dates and the account that applied or lifted them, to
        manage abuse and review moderation decisions. Restriction reasons are
        visible to the affected user and authorized moderators. Community
        removal hides its content without deleting its records. Contact us to
        contest a restriction or discuss deletion of these records.
      </p>
      <h2>Service providers</h2>
      <p>
        Vercel hosts the application and processes operational request logs;
        Supabase hosts PostgreSQL; Kinde provides authentication; UploadThing
        stores uploaded images. Your browser contacts image hosts when loading
        images. Their services may process technical information such as IP
        addresses, device information and service logs. Google or GitHub also
        processes your sign-in when you choose that option.
      </p>
      <p>
        Common does not currently install advertising or audience analytics
        SDKs, sell account data, or send marketing campaigns. Public posts can
        be read and copied by other people and search engines.
      </p>
      <h2>Storage and retention</h2>
      <p>
        We keep account records and content to operate the service. Deleting a
        post or comment clears its body in the application database while
        preserving a thread placeholder and record for integrity and spam
        limits. Uploaded files and provider account records are separate;
        deleting a post does not itself delete those copies. Recovery backups
        may contain older records. Contact us for a request covering those
        systems.
      </p>
      <p>
        We do not promise immediate erasure from backups or from copies other
        people made. Backup retention and provider retention must be considered
        when completing a request.
      </p>
      <h2>Your choices and requests</h2>
      <p>
        You can edit your username and your own content, leave communities,
        unsave posts and sign out. For an account data copy, correction,
        deletion, privacy question or copyright concern, use{" "}
        <a href="/contact">Contact &amp; data requests</a>. We verify account
        ownership before disclosing or deleting account data. Do not send a
        password or sign-in code.
      </p>
      <h2>Teenagers and children</h2>
      <p>
        Common is intended for teenagers and adults, not children under 13. Use
        it only if you meet the minimum age required where you live. We do not
        collect birth dates or operate a parental consent service. If you
        believe a child under 13 has an account, contact us so we can
        investigate and address the account and associated data.
      </p>
      <h2>Cookies and changes</h2>
      <p>
        See our <a href="/cookies">cookie and browser-storage policy</a>. We
        will update this page when our practices change. This notice describes
        this project; it is not a certification of compliance with every
        jurisdiction.
      </p>
    </>
  );
}
