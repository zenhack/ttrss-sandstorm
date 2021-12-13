<?php
abstract class Auth_Base extends Plugin implements IAuthModule {
	protected $pdo;

	const AUTH_SERVICE_API = '_api';

	function __construct() {
		$this->pdo = Db::pdo();
	}

	function hook_auth_user($login, $password, $service = '') {
		return $this->authenticate($login, $password, $service);
	}

	/** Auto-creates specified user if allowed by system configuration.
	 * Can be used instead of find_user_by_login() by external auth modules
	 * @param string $login
	 * @param string|false $password
	 * @return null|int
	 * @throws Exception
	 * @throws PDOException
	 */
	function auto_create_user(string $login, $password = false) {
		if ($login && Config::get(Config::AUTH_AUTO_CREATE)) {
			$user_id = UserHelper::find_user_by_login($login);

			if (!$user_id) {

				if (!$password) $password = make_password();

				$user = ORM::for_table('ttrss_users')->create();

				$user->salt = UserHelper::get_salt();
				$user->login = mb_strtolower($login);
				$user->pwd_hash = UserHelper::hash_password($password, $user->salt);
				$user->access_level = 0;
				$user->created = Db::NOW();
				$user->save();

				return UserHelper::find_user_by_login($login);

			} else {
				return $user_id;
			}
		}

		return UserHelper::find_user_by_login($login);
	}


	/** replaced with UserHelper::find_user_by_login()
	 * @param string $login
	 * @return null|int
	 * @deprecated
	 */
	function find_user_by_login(string $login) {
		return UserHelper::find_user_by_login($login);
	}
}
