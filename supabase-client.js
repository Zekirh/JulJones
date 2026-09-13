import {
    createClient
} from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ojvcwtjcbszenatgeyco.supabase.co";
const SUPABASE_KEY = "sb_publishable_InK1Q2kRf9Dsfo9vTTAEYw_p_RrP4gk";

export const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );